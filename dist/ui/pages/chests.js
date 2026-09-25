import {chestCard} from '../components/chest-card.js?v=40';
import {pageHeader,backButton,iconButton,backIcon,statCard,disclosure} from '../primitives.js?v=40';
export const chestsPage = () => `<section id="chests" class="tab" hidden>${pageHeader({title:"Сундуки"})}${chestCard()}</section>`;
