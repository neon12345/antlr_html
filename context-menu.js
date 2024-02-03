/*
https://github.com/mturco/context-menu
MIT License

Copyright (c) 2018 Matt Turco

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).ContextMenu=t()}(this,function(){"use strict";var e,t,n,i;e=".ContextMenu{display:none;list-style:none;margin:0;max-width:250px;min-width:125px;padding:0;position:absolute;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.ContextMenu--theme-default{background-color:#fff;border:1px solid rgba(0,0,0,.2);-webkit-box-shadow:0 2px 5px rgba(0,0,0,.15);box-shadow:0 2px 5px rgba(0,0,0,.15);font-size:13px;outline:0;padding:2px 0}.ContextMenu--theme-default .ContextMenu-item{padding:6px 12px}.ContextMenu--theme-default .ContextMenu-item:focus,.ContextMenu--theme-default .ContextMenu-item:hover{background-color:rgba(0,0,0,.05)}.ContextMenu--theme-default .ContextMenu-item:focus{outline:0}.ContextMenu--theme-default .ContextMenu-divider{background-color:rgba(0,0,0,.15)}.ContextMenu.is-open{display:block}.ContextMenu-item{cursor:pointer;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ContextMenu-divider{height:1px;margin:4px 0}",i=(t=void 0===t?{}:t).insertAt,e&&"undefined"!=typeof document&&(n=document.head||document.getElementsByTagName("head")[0],(t=document.createElement("style")).type="text/css","top"===i&&n.firstChild?n.insertBefore(t,n.firstChild):n.appendChild(t),t.styleSheet?t.styleSheet.cssText=e:t.appendChild(document.createTextNode(e)));var o=[],s=0;function u(e,t,n){void 0===n&&(n={});var i=document.createEvent("Event");Object.keys(n).forEach(function(e){i[e]=n[e]}),i.initEvent(t,!0,!0),e.dispatchEvent(i)}Element.prototype.matches||(Element.prototype.matches=Element.prototype.msMatchesSelector);function a(e,t,n){void 0===n&&(n={className:"",minimalStyling:!1}),this.selector=e,this.items=t,this.options=n,this.id=s++,this.target=null,this.create(),o.push(this)}return a.prototype.create=function(){var i=this;this.menu=document.createElement("ul"),this.menu.className="ContextMenu",this.menu.setAttribute("data-contextmenu",this.id),this.menu.setAttribute("tabindex",-1),this.menu.addEventListener("keyup",function(e){switch(e.which){case 38:i.moveFocus(-1);break;case 40:i.moveFocus(1);break;case 27:i.hide()}}),this.options.minimalStyling||this.menu.classList.add("ContextMenu--theme-default"),this.options.className&&this.options.className.split(" ").forEach(function(e){return i.menu.classList.add(e)}),this.items.forEach(function(e,t){var n=document.createElement("li");"name"in e?(n.className="ContextMenu-item",n.textContent=e.name,n.setAttribute("data-contextmenuitem",t),n.setAttribute("tabindex",0),n.addEventListener("click",i.select.bind(i,n)),n.addEventListener("keyup",function(e){13===e.which&&i.select(n)})):n.className="ContextMenu-divider",i.menu.appendChild(n)}),document.body.appendChild(this.menu),u(this.menu,"created")},a.prototype.show=function(e){this.menu.style.left=e.pageX+"px",this.menu.style.top=e.pageY+"px",this.menu.classList.add("is-open"),this.target=e.target,this.menu.focus(),e.preventDefault(),u(this.menu,"shown",{context:this.target})},a.prototype.hide=function(){this.menu.classList.remove("is-open"),this.target=null,u(this.menu,"hidden")},a.prototype.select=function(e){e=e.getAttribute("data-contextmenuitem");this.items[e]&&this.items[e].fn(this.target),this.hide(),u(this.menu,"itemselected")},a.prototype.moveFocus=function(e){void 0===e&&(e=1);var t,n=this.menu.querySelector("[data-contextmenuitem]:focus");(t=(t=n?function e(t,n,i){t=0<(i=void 0===i?1:i)?t.nextElementSibling:t.previousElementSibling;return!t||t.matches(n)?t:e(t,n,i)}(n,"[data-contextmenuitem]",e):t)||(0<e?this.menu.querySelector("[data-contextmenuitem]:first-child"):this.menu.querySelector("[data-contextmenuitem]:last-child")))&&t.focus()},a.prototype.on=function(e,t){this.menu.addEventListener(e,t)},a.prototype.off=function(e,t){this.menu.removeEventListener(e,t)},a.prototype.destroy=function(){this.menu.parentElement.removeChild(this.menu),this.menu=null,o.splice(o.indexOf(this),1)},document.addEventListener("contextmenu",function(t){o.forEach(function(e){(function(selector, child) {
    while (child) {
        if (child.matches && child.matches(selector)) {
            return true;
        }
        child = child.parentNode;
    }
    return false;
})(e.selector,t.target)&&e.show(t)})}),document.addEventListener("click",function(t){o.forEach(function(e){t.target.matches('[data-contextmenu="'+e.id+'"], [data-contextmenu="'+e.id+'"] *')||e.hide()})}),a});
