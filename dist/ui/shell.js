import {appHeader} from './components/app-header.js?v=93';
import {bottomNavigation} from './components/bottom-navigation.js?v=93';
import {playPage} from './pages/play.js?v=93';
import {profilePage} from './pages/profile.js?v=93';
import {collectionPage} from './pages/collection.js?v=93';
import {chestsPage} from './pages/chests.js?v=93';
import {archivePage} from './pages/archive.js?v=93';
import {statisticsPage} from './pages/statistics.js?v=93';
import {calendarPage} from './pages/calendar.js?v=93';
import {faqPage} from './pages/faq.js?v=93';
export const mountAppShell = root => {
 root.innerHTML=appHeader()+'<main>'+bottomNavigation()+playPage()+profilePage()+collectionPage()+chestsPage()+archivePage()+statisticsPage()+calendarPage()+faqPage()+'</main>'+"<dialog id=\"modal\"><div id=\"modal-content\"></div><div class=\"dialog-footer\"><button id=\"close-modal\" class=\"quiet\">Закрыть</button></div></dialog><div class=\"notification-stack\"><button id=\"update-app\" class=\"primary update-app\" hidden>Обновить приложение</button><div id=\"toast\" role=\"status\" aria-live=\"polite\" hidden></div></div>";
};
