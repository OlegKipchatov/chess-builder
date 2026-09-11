import {createFileRoute} from '@tanstack/react-router';
import {CollectionScreen} from '../features/Collection';
export const Route=createFileRoute('/collection')({component:()=> <CollectionScreen/>});
