/*
Copyright luojia@luojia.me
LGPL license
*/
import Template from './textModuleTemplate.js';

class TextCanvas extends Template{
	constructor(dText){
		super(dText);
		this.supported=dText.text2d.supported;
		if(!this.supported)return;
		dText.frame.styleSheet.insertRule(`#${dText.randomText}_textCanvasContainer canvas{will-change:transform;top:0;left:0;position:absolute;}`,0);
		dText.frame.styleSheet.insertRule(`#${dText.randomText}_textCanvasContainer.moving canvas{transition:transform 500s linear;}`,0);
		dText.frame.styleSheet.insertRule(`#${dText.randomText}_textCanvasContainer{will-change:transform;pointer-events:none;overflow:hidden;}`,0);

		dText.textCanvasContainer=document.createElement('div');//for text canvas
		dText.textCanvasContainer.classList.add(`${dText.randomText}_fullfill`);
		dText.textCanvasContainer.id=`${dText.randomText}_textCanvasContainer`;
		dText.container.appendChild(dText.textCanvasContainer);
		document.addEventListener('visibilitychange',e=>{
			if(dText.renderMode===1 &&!document.hidden){
				this.resetPos();
			}
		});
	}
	pause(){
		let T=this.dText.frame.time;
		this.dText.textCanvasContainer.classList.remove('moving');
		for(let dT=this.dText,i=dT.DanmakuText.length,t;i--;){
			if((t=dT.DanmakuText[i]).danmaku.mode>=2)continue;
			let X=this.dText._calcSideDanmakuPosition(t,T,this.dText.width);
			t._cache.style.transform=`translate3d(${(((X-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
		}
	}
	start(){
		let T=this.dText.frame.time;
		this.dText.textCanvasContainer.classList.add('moving');
		for(let dT=this.dText,i=dT.DanmakuText.length,t;i--;){
			if((t=dT.DanmakuText[i]).danmaku.mode<2)
				this._move(t,T);
		}
	}
	_move(t,T=this.dText.frame.time){
		requestAnimationFrame(()=>{
			if(!t.danmaku)return;
			let X=this.dText._calcSideDanmakuPosition(t,T+500000,this.dText.width);
			t._cache.style.transform=`translate3d(${(((X-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
		});
	}
	resetPos(){
		this.pause();
		if(!this.dText.paused)setImmediate(()=>{
			this.start();	
		});
	}
	resize(){
		this.resetPos();
	}
	remove(t){
		this.dText.textCanvasContainer.removeChild(t._cache);
	}
	enable(){
		this.dText.textCanvasContainer.hidden=false;
	}
	disable(){
		this.dText.textCanvasContainer.hidden=true;
	}
	newDanmaku(t){
		t._cache.style.transform=`translate3d(${(((t.style.x-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
		this.dText.textCanvasContainer.appendChild(t._cache);
		if(t.danmaku.mode<2)
			this._move(t);
	}
}


export default TextCanvas;
