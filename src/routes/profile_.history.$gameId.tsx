import {createFileRoute} from '@tanstack/react-router';
import {GameScreen} from '../features/Game';
export const Route=createFileRoute('/profile_/history/$gameId')({component:()=>{const {gameId}=Route.useParams();return <GameScreen archiveId={gameId}/>;}});
