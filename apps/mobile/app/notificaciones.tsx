import {ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Inbox} from '@/components/Inbox';
import {BackButton,H1} from '@/components/ui';
import {c} from '@/theme';
export default function Notifications(){return <SafeAreaView style={{flex:1,backgroundColor:c.background}}><ScrollView contentContainerStyle={{padding:20,gap:20}}><BackButton/><H1>Notificaciones</H1><Inbox page/></ScrollView></SafeAreaView>;}
