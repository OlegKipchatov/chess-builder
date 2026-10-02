import {appHeader} from './components/app-header.js?v=89';
import {bottomNavigation} from './components/bottom-navigation.js?v=89';
import {playPage} from './pages/play.js?v=89';
import {profilePage} from './pages/profile.js?v=89';
import {collectionPage} from './pages/collection.js?v=89';
import {chestsPage} from './pages/chests.js?v=89';
import {archivePage} from './pages/archive.js?v=89';
import {statisticsPage} from './pages/statistics.js?v=89';
import {calendarPage} from './pages/calendar.js?v=89';
import {faqPage} from './pages/faq.js?v=89';
export const mountAppShell = root => {
 root.innerHTML=appHeader()+'<main>'+bottomNavigation()+playPage()+profilePage()+collectionPage()+chestsPage()+archivePage()+statisticsPage()+calendarPage()+faqPage()+'</main>'+"<dialog id=\"modal\"><div id=\"modal-content\"></div><div class=\"dialog-footer\"><button id=\"close-modal\" class=\"quiet\">Закрыть</button></div></dialog><div class=\"notification-stack\"><button id=\"update-app\" class=\"primary update-app\" hidden>Обновить приложение</button><div id=\"toast\" role=\"status\" aria-live=\"polite\" hidden></div></div>";
};
