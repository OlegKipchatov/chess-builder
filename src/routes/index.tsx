import {createFileRoute} from '@tanstack/react-router';
import {GameScreen} from '../features/Game';
export const Route=createFileRoute('/')({component:()=> <GameScreen/>});
