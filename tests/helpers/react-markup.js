import {createElement,Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AnalysisInsight} from '../../src/features/game-review/AnalysisInsight.tsx';
import {RewardBreakdownView} from '../../src/features/game-session/MatchReward.tsx';
import {ActivityCelebration} from '../../src/features/game-session/ActivityCelebration.tsx';
export const analysisInsight=move=>renderToStaticMarkup(createElement(AnalysisInsight,{move}));
export const matchResultDialog=(title,total,entry,breakdown,reason)=>renderToStaticMarkup(createElement(Fragment,null,createElement('h2',null,entry.result||title),reason&&createElement('p',{className:'match-end-reason'},reason),createElement(RewardBreakdownView,{breakdown})));
export const activityDialog=event=>renderToStaticMarkup(createElement(ActivityCelebration,{event}));
