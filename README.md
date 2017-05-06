#danmaku-text

作为 [danmaku-frame](https://coding.net/u/luojia/p/danmaku-frame) 模块使用的文本弹幕模块。

拥有以下三种模式

1. css transition : 流畅，但在高密度弹幕情况下极耗cpu
2. canvas 2d : 不如上面流畅，但能较轻松应对大量弹幕
3. webgl(不建议使用，尚有性能问题)

## 加载模块

```javascript
import {DanmakuFrame,DanmakuFrameModule} from 'danmaku-frame.js'
import initTextDanmaku from 'danmaku-text.js'

//把本模块装入弹幕框架
initTextDanmaku(DanmakuFrame,DanmakuFrameModule);

var danmakuFrame=new DanmakuFrame();

danmakuFrame.modules.TextDanmaku //TextDanmaku对象
```

# class TextDanmaku

### .setRenderMode(mode)
设置弹幕渲染模式

* mode : (number)模式，序号见顶部说明

### .removeText(textObject)
移除一个屏幕上的弹幕对象

* textObject : (TextGraph对象)要移除的弹幕对象

### .clear()
清空屏幕上的弹幕

### .recheckIndexMark([time])
重新检查指定时间的弹幕序号

* time(可选) :  (number)时间，默认为当前框架的时间

 > 弹幕序号
 > 载入本模块的弹幕都会按时间排序装入本模块的`list`数组，并且在运行的时候按顺序取出，所以有一个记录下一个需要取出的弹幕的序号。此方法用于重新检查指定时间下需要取出的弹幕的序号。

### .danmakuAt(x,y)
获取指定坐标上的弹幕列表

* x,y : (number)相对于弹幕框架左上角的坐标

返回一个`Array`，元素为通过弹幕框架的`load`方法载入的弹幕对象。

### .list
(array)按时间顺序存放着载入的弹幕对象

### .defaultStyle
(object)设置默认的弹幕样式

* fontStyle: null //字样式，见同名css属性
* fontWeight: 300 //字重
* fontVariant: null //字变体，见同名css属性
* color: "#fff" //字颜色
* lineHeight: 字号+2 //行高，不可改变默认设置。
* fontSize: 24 //字号
* fontFamily: "Arial" //字体
* strokeWidth: 1 //描边宽度
* strokeColor: "#888" //描边颜色
* shadowBlur: 5 //阴影模糊度
* textAlign:'start' //取值为`left right center start end`中的一个，设置文本对其方式
* shadowColor: "#000" //阴影颜色
* shadowOffsetX:0 //阴影x偏移
* shadowOffsetY:0 //阴影y偏移
* fill:true //填充文字

### .renderMode
(number)目前的渲染模式序号

### .DanmakuText
(array)当前显示在屏幕上的弹幕对象

### .options
(object)文本弹幕设置

* allowLines:false //允许多行弹幕
* screenLimit:0 //同屏弹幕限制
* clearWhenTimeReset:true //改变时间的时候清空屏幕上的弹幕
* speed:6.5 //速度

## 使用的库

* [Mat.js](https://coding.net/u/luojia/p/Mat.js/git) : 矩阵库
* [setImmediate](https://github.com/YuzuJS/setImmediate) : setImmediate支持
