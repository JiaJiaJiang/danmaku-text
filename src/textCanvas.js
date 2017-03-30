/*
Copyright luojia@luojia.me
LGPL license
*/
import Template from './textModuleTemplate.js';

class TextCanvas extends Template{
	constructor(dText){
		super(dText);
		this.supported=dText.text2d.supported;
		document.styleSheets[0].insertRule(`#${dText.randomText}_textCanvasContainer canvas{top:0;left:0;position:absolute;}`,0);
		document.styleSheets[0].insertRule(`#${dText.randomText}_textCanvasContainer{pointer-events:none;transform:translateZ(0);overflow:hidden;}`,0);

		dText.textCanvasContainer=document.createElement('div');//for text canvas
		dText.textCanvasContainer.classList.add(`${dText.randomText}_fullfill`);
		dText.textCanvasContainer.id=`${dText.randomText}_textCanvasContainer`;
		dText.container.appendChild(dText.textCanvasContainer);
	}
	danmakuPosition(t){
		t._cache.style.transform=`translate3d(${(((t.style.x-t.estimatePadding)*10)|0)/10}px,0,0)`;
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
		t._cache.style.top=`${t.style.y-t.estimatePadding}px`;
		t._cache.style.transform=`translate3d(${(((t.style.x-t.estimatePadding)*10)|0)/10}px,0,0)`;
		this.dText.textCanvasContainer.appendChild(t._cache);
	}
}


export default TextCanvas;
