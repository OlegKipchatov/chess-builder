import {createFileRoute} from '@tanstack/react-router';
import {ChestsScreen} from '../features/Chests';
export const Route=createFileRoute('/chests')({component:()=> <ChestsScreen/>});
