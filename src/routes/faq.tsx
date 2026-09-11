import {createFileRoute} from '@tanstack/react-router';
import {FaqScreen} from '../features/Faq';
export const Route=createFileRoute('/faq')({component:()=> <FaqScreen/>});
