import {chestCard} from '../components/chest-card.js?v=126';
import {pageHeader,backButton,iconButton,backIcon,statCard,disclosure} from '../primitives.js?v=126';
export const chestsPage = () => `<section id="chests" class="tab" data-page-kind="root" hidden>${pageHeader({title:"Сундуки"})}<div class="page-content">${chestCard()}</div></section>`;
