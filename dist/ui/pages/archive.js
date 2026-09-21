import {pageHeader,backButton,iconButton,backIcon,statCard,disclosure} from '../primitives.js?v=29';
export const archivePage = () => `<section id="archive" class="tab" hidden>${pageHeader({title:"История партий",startContent:backButton('profile')})}<div id="match-archive" class="archive-viewport" tabindex="0" role="region" aria-label="История партий"></div></section>`;
