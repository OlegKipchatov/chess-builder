import {createFileRoute} from '@tanstack/react-router';
import {ProfileScreen} from '../features/Profile';
export const Route=createFileRoute('/profile')({component:()=> <ProfileScreen/>});
