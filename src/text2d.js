/*
Copyright luojia@luojia.me
LGPL license
*/
import Template from './textModuleTemplate.js';

class Text2d extends Template{
	constructor(dText){
		super(dText);
		this.supported=false;
		dText.canvas=document.createElement('canvas');//the canvas
		dText.context2d=dText.canvas.getContext('2d');//the canvas contex
		if(!dText.context2d){
			console.warn('text 2d not supported');
			return;
		}
		dText.canvas.classList.add(`${dText.randomText}_fullfill`);
		dText.canvas.id=`${dText.randomText}_text2d`;
		dText.container.appendChild(dText.canvas);
		this.supported=true;
	}
	draw(force){
		let ctx=this.dText.context2d,
			cW=ctx.canvas.width,
			dT=this.dText.DanmakuText,
			i=dT.length,
			t;
		ctx.globalCompositeOperation='destination-over';
		this.clear(force);
		for(;i--;){
			(t=dT[i]).drawn||(t.drawn=true);
			if(cW>=t._cache.width){//danmaku that smaller than canvas width
				ctx.drawImage(t._bitmap||t._cache, t.style.x-t.estimatePadding, t.style.y-t.estimatePadding);
			}else if(t.style.x-t.estimatePadding>=0){
				ctx.drawImage(t._bitmap||t._cache, 0,0,cW,t._cache.height,t.style.x-t.estimatePadding,t.style.y-t.estimatePadding,cW,t._cache.height);
			}else{
				if(t.style.x-t.estimatePadding+t._cache.width<=cW){
					ctx.drawImage(t._bitmap||t._cache, t.estimatePadding-t.style.x,0,t.style.x-t.estimatePadding+t._cache.width,t._cache.height,0,t.style.y-t.estimatePadding,t.style.x-t.estimatePadding+t._cache.width,t._cache.height);
				}else{
					ctx.drawImage(t._bitmap||t._cache, t.estimatePadding-t.style.x,0,cW,t._cache.height,0,t.style.y-t.estimatePadding,cW,t._cache.height);
				}
			}
		}
	}
	clear(force){
		const D=this.dText;
		if(force||this._evaluateIfFullClearMode()){
			D.context2d.clearRect(0,0,D.canvas.width,D.canvas.height);
			return;
		}
		for(let i=D.DanmakuText.length,t;i--;){
			t=D.DanmakuText[i];
			if(t.drawn)
				D.context2d.clearRect(t.style.x-t.estimatePadding,t.style.y-t.estimatePadding,t._cache.width,t._cache.height);
		}
	}
	_evaluateIfFullClearMode(){
		if(this.dText.DanmakuText.length>3)return true;
		let l=this.dText.GraphCache[this.dText.GraphCache.length-1];
		if(l&&l.drawn){
			l.drawn=false;
			return true;
		}
		return false;
	}
	resize(){
		let D=this.dText,C=D.canvas;
		C.width=D.width;
		C.height=D.height;
	}
	enable(){
		this.draw();
		this.dText.useImageBitmap=!(this.dText.canvas.hidden=false);
	}
	disable(){
		this.dText.canvas.hidden=true;
		this.clear(true);
	}
}

export default Text2d;