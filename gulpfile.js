const fs = require('fs');
const isProd = process.env.NODE_ENV === 'production';
const { watch, series, parallel, src, dest } = require('gulp'),
    sass = require('gulp-sass')(require('sass')),
    cleanCSS = require('gulp-clean-css'),
    del = require('del'),
    gulpif = require('gulp-if'),
    rev = require('gulp-rev'),
    uglify = require('gulp-uglify'),
    minimist = require('minimist'),
    revCollector = require('gulp-rev-collector'),
    notify = require('gulp-notify'),
    autoprefixer = require('gulp-autoprefixer'),
    browserify = require('browserify'),
    // 转成stream流
    source = require('vinyl-source-stream'),
    streamify = require('gulp-streamify');

// 读取命令行参数并解析参数
// cross-env NODE_ENV=dev gulp dev --path ./src/js/new.js
const options = minimist(process.argv.slice(3))

async function delDist() {
    await del(['dist/js']);
    await del(['dist/css']);
    await del(['dist/images']);
    await del(['rev/js']);
    await del(['rev/css']);
}

async function delJs() {
    await del(['dist/js']);
    await del(['rev/js']);
}

async function delCss() {
    await del(['dist/css']);
    await del(['rev/css']);
}

async function delImg() {
    await del(['dist/images']);
}

// 编译sass
// 自动添加css前缀
// 压缩css
function handleSass() {
    return src(['./src/sass/**/*.scss', '!src/sass/module/*.scss', '!src/sass/base.scss'])
        .pipe(sass({
            includePaths: ['./node_modules']
        }))
        // 重命名
        // .pipe(rename({ suffix: '.min' }))
        // 添加前缀(如：-webkit-)
        .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
        .pipe(dest('./dist/css'))
        // 压缩css
        .pipe(cleanCSS())
        .pipe(rev())
        .pipe(dest('dist/css'))
        // CSS 生成文件 hash 编码并生成 rev-manifest.json 文件，里面定义了文件名对照映射
        .pipe(rev.manifest())
        .pipe(dest('rev/css'));
}

// 拷贝图片到dist目录
async function handleImage() {
    await del(['./dist/images']);
    return src(['./src/images/**'])
        .pipe(dest('./dist/images'));
}


const vendors = ['jquery'];

// 抽离公共模块单独打包
function vender() {
    var bf = browserify({
        debug: false
    });
    vendors.forEach(lib => {
        // 这里require公共模块，下面将额外打包vender的模块
        bf.require(lib);
    });
    return bf.transform(["babelify", {
        plugins: [
            "@babel/plugin-transform-runtime",
        ],
        "presets": [
            ["@babel/preset-env", {
          }]
        ],
        global: true,
    }])
        .bundle()
        .pipe(source('vender.js'))
        .pipe(streamify(uglify()))
        .pipe(dest("dist/js"))
        .pipe(streamify(rev()))
        .pipe(dest("dist/js"))
        .pipe(rev.manifest("rev/js/rev-manifest.json", { merge: true }))
        .pipe(dest('./'))
}

// 使用babel把es6转化为es5的时候, 会把代码转换为cmd模式，浏览器端不识别requrie，nodejs环境可以识别
// 使用browserify转换成浏览器能识别的模式
function babelJs(entry) {
    const entryDir = 'src/js/';
    const out = entry.replaceAll('\\', '/').replace(`./${entryDir}`, entryDir).replace(entryDir, '');
    let stream = browserify({
        entries: entry,
        ignoreMissing: true,
        // 开发模式下开启souceMap的debug模式
        // debug: isProd ? false : true,
        transform: [['babelify', {
            // 自动移除语法转换后内联的辅助函数（inline Babel helpers），使用@babel/runtime/helpers里的辅助函数来替代；webpack等打包的时候会基于模块来做去重工作，这里不能去重，可加可不加
            plugins: [
                "@babel/plugin-transform-runtime",
            ],
            "presets": [
                ["@babel/preset-env", {
                //"useBuiltIns": "usage"
              }]
            ],
            sourceMaps: true,
            //global: true,
            //ignore: [/\/node_modules\//]
        }]],
    })
        // 抽离公共模块单独打包
        .external(vendors)
        .bundle()
        .pipe(source(out))
        .pipe(dest("dist/js"))

    // 返回异步操作，确保series()方法的执行顺序
    return stream
        .pipe(streamify(gulpif(isProd, uglify()))) // 仅在生产环境时候进行压缩
        .pipe(streamify(rev()))
        .pipe(dest('dist/js/'))
        .pipe(rev.manifest("rev/js/rev-manifest.json", { merge: true }))
        .pipe(dest('./'))
}

// 遍历每个js,每个js文件单独输出一个babelJs任务（tasks）,按顺序执行babelJs任务，
// 为了browserify编译生成哈希映射文件时，按顺序修改js/rev-manifest.json文件
// 多个异步程序同时修改js/rev-manifest.json文件，会导致文件写入错误
// 返回值格式[() => babelJs("./src/js/a.js"), () => babelJs("./src/js/b.js")]
function handleJs() {
    let arr = [];
    handlePath('./src/js/')
    function handlePath(path) {
        fs.readdirSync(path).map(entry => {
            const file = `${path}${entry}`;
            const stat = fs.lstatSync(file);
            //判断是否文件夹
            if (stat.isDirectory(file)) {
                handlePath(`${file}/`)
            } else {
                let target = entry.split('.');
                if (target[target.length - 1] === 'js') {
                    arr.push(function babelAndUglifyJs() {
                        return babelJs(file)
                    })
                }
            }
        })
    }
    return arr;
}

function replaceRev() {
    return src(['rev/**/*.json', 'src/**/*.html'])
        .pipe(revCollector({
            replaceReved: true,
        }))
        .pipe(dest('dist'))
        .pipe(notify({ message: '版本号替换完成' }));
}

exports.build = series(delDist, parallel(handleSass, handleImage, series(vender, ...handleJs())), replaceRev);

// 开发模式
// 动态监听文件改变，批量重新编译
// exports.dev = function(){
//     watch(['src/js/**/*.js'], { ignoreInitial: false }, series(delJs, ...handleJs(), replaceRev))
//     watch(['src/sass/**/*.scss'], { ignoreInitial: false }, series(delCss, handleSass, replaceRev))
//     watch(['src/images/**'], { ignoreInitial: false }, series(delImg, handleImage))
//     watch(['src/html/**/*.html'], { ignoreInitial: false }, series(replaceRev))
// }

// 监听文件变化
function watchFile(cb) {

    // 监听js文件变化，单独编译修改的js
    const watcher = watch(['./src/js/**/*.js']);
    watcher.on('change', function (path) {
        const entryPath = path.replaceAll('\\', '/');
        if (entryPath.includes('/module/')) {
            console.info(`修改文件：${path}`);
            console.info('编译所有js')
            series(...handleJs())()
        } else {
            console.info(`修改文件：${path}`);
            babelJs(path)
            del([entryPath.replace('src/', 'dist/').replaceAll('.js', '-*.js')]);
        }
    });
    watcher.on('add', function (path) {
        console.info(`增加文件：${path}`);
        babelJs(path)
    });
    watcher.on('unlink', function (path) {
        console.info(`删除文件：${path}`);
        const outFile = path.replaceAll('\\', '/').replace('src/', 'dist/')
        del([outFile])
        del([outFile.replaceAll('.js', '-*.js')]);
    });

    watch(['src/sass/**/*.scss'], series(delCss, handleSass))
    watch(['src/images/**'], series(delImg, handleImage))
    watch(['rev/**/*.json'], series(replaceRev))
    watch(['src/html/**/*.html'], series(replaceRev))
}

exports.dev = series(delDist, parallel(handleSass, handleImage, series(vender, ...handleJs())), replaceRev, watchFile)





