// After a homepage or agent seed, the outline page used to wait for a template
// click and a second "继续" click. A fresh outline now uses the general template
// and starts the slide stream. Reopening a deck does not, because that status
// is only set when this visit's outline stream completes.

const PICKER =
  '[d,u]=(0,Yl.useState)(!0),[f,m]=(0,Yl.useState)(null),[g,y]=(0,Yl.useState)(s?lue(s):UPe)'
const PICKER_NEXT =
  '[d,u]=(0,Yl.useState)(!1),[f,m]=(0,Yl.useState)(a||"general"),[g,y]=(0,Yl.useState)(s?lue(s):UPe)'
const EFFECT = '(0,Yl.useEffect)(()=>{if(!l||!S){_(!1);return}H&&_(!0)},[S,H,l]);'
const CONTINUE =
  'let deckAuto=(0,Yl.useRef)(!1);(0,Yl.useEffect)(()=>{if(deckAuto.current||!l||!S||E.isStreaming||E.isLoading||T.isLoading)return;if(E.statusMessage!=="\\u5927\\u7EB2\\u5DF2\\u751F\\u6210")return;deckAuto.current=!0;void D()},[E.statusMessage,E.isStreaming,E.isLoading,T.isLoading,S,l,D]);'

/** The built workbench bundle. Throws when an anchor is not exactly once. */
export function armDeckAutostart(source) {
  const picker = source.split(PICKER).length - 1
  const effect = source.split(EFFECT).length - 1
  if (picker !== 1 || effect !== 1) {
    throw new Error(`deck autostart anchors: picker ${picker}, effect ${effect}`)
  }
  return source.replace(PICKER, PICKER_NEXT).replace(EFFECT, EFFECT + CONTINUE)
}
