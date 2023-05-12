import Urils from './module/utils';
import Urils2 from './module/utils2';
import API from './module/url';
import $ from 'jquery';
// import Swiper from 'swiper';

// let mySwiper = new Swiper ('.swiper-container', {
//   // 如果需要分页器
//   pagination: {
//     el: '.swiper-pagination',
//   },
//   // 如果需要前进后退按钮
//   navigation: {
//     nextEl: '.swiper-button-next',
//     prevEl: '.swiper-button-prev',
//   },
//   loop:true,
//   autoplay: {
//     delay: 5000,//5秒切换一次
//   },
//   lazy: {
//     loadPrevNext: true,
//     loadingClass: 'swiper-lazy-loading',
//   },
// })

const arr = [1, 2, 3];
const arr2 = [...arr, 4];
console.log('arr2', arr2)

Urils.test1();
console.log('API.login', API.login)

Urils2.test1();

const myPromise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('成功');
  }, 300);
}).then(res => console.log(res));

async function test(){
  const res = await new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('成功2');
    }, 500);
  })
  console.log(res)
}

test();

class B{
  constructor(){
    this.b = 'b'
  }
}

class A extends B{
  constructor(){
    super();
    this.a = 'A'
  }
}

const class_ab = new A();
console.log('class_ab', class_ab)

let obj = {a: {b: 1}};
let tar = {};
let copy = Object.assign(tar, obj);
console.log('copy', copy)
