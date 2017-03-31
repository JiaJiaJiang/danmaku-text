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
		document.styleSheets[0].insertRule(`#${dText.randomText}_textCanvasContainer canvas{will-change:transform;top:0;left:0;position:absolute;}`,0);
		document.styleSheets[0].insertRule(`#${dText.randomText}_textCanvasContainer{will-change:transform;pointer-events:none;overflow:hidden;}`,0);

		dText.textCanvasContainer=document.createElement('div');//for text canvas
		dText.textCanvasContainer.classList.add(`${dText.randomText}_fullfill`);
		dText.textCanvasContainer.id=`${dText.randomText}_textCanvasContainer`;
		dText.container.appendChild(dText.textCanvasContainer);
	}
	draw(){
		for(let dT=this.dText,i=dT.DanmakuText.length,t;i--;){
			if((t=dT.DanmakuText[i]).danmaku.mode>=2)continue;
			t._cache.style.transform=`translate3d(${(((t.style.x-t.estimatePadding)*10)|0)/10}px,${t.style.y-t.estimatePadding}px,0)`;
		}
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
	}
}


export default TextCanvas;
