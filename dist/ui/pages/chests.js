import {chestCard} from '../components/chest-card.js?v=35';
import {pageHeader,backButton,iconButton,backIcon,statCard,disclosure} from '../primitives.js?v=35';
export const chestsPage = () => `<section id="chests" class="tab" hidden>${pageHeader({title:"Сундуки"})}${chestCard()}</section>`;
