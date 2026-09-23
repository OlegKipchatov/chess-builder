// Text/attributes are escaped; *Content slots accept trusted component markup only.
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const attributes = values => Object.entries(values).filter(([, value]) => value !== false && value != null).map(([key,value]) => value === true ? key : `${key}="${escapeHTML(value)}"`).join(' ');
export const button = ({label='', content, variant='secondary', className='', ...attrs} = {}) => `<button ${attributes({type:'button',...attrs,class:`ui-button ${variant==='primary'?'primary':variant==='ghost'?'text-button':'quiet'} ${className}`.trim()})}>${content ?? escapeHTML(label)}</button>`;
export const iconButton = ({label, icon, ...props}) => button({...props,content:icon,'aria-label':label,title:label,className:`icon-button ${props.className||''}`});
export const backIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m14 5-7 7 7 7M7 12h14"/></svg>';
export const backButton = (target,label='В профиль') => iconButton({label,icon:backIcon,'data-go':target});
export const pageHeader = ({title,titleId,description='',startContent='',endContent='',className='',level=1}) => `<div class="page-header ${level===2?'section-header':''} ${className}">${startContent?`<div class="page-header-start">${startContent}</div>`:''}<div class="page-header-content"><h${level} ${attributes({id:titleId})}>${escapeHTML(title)}</h${level}>${description?`<p class="page-description">${escapeHTML(description)}</p>`:''}</div>${endContent?`<div class="page-header-end">${endContent}</div>`:''}</div>`;
export const sectionHeader = props => pageHeader({...props,level:2});
export const statCard = (value,label,id) => `<article class="stat-card"><strong ${attributes({id})}>${escapeHTML(value)}</strong><span>${escapeHTML(label)}</span></article>`;
export const emptyState = text => `<p class="empty-note">${escapeHTML(text)}</p>`;
export const badge = text => `<span class="badge">${escapeHTML(text)}</span>`;
export const disclosure = (title,content) => `<details class="faq-accordion"><summary>${escapeHTML(title)}</summary><div class="disclosure-content">${content}</div></details>`;

export const plural = (value,forms) => {
  const mod100=Math.abs(value)%100,mod10=Math.abs(value)%10;
  return forms[mod100>10&&mod100<20?2:mod10===1?0:mod10>1&&mod10<5?1:2];
};
