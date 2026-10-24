import {useState} from 'react';
import {Modal,Pressable,TextInput,FlatList,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {searchServiceCities,serviceCity} from '@hulul/shared';
import {useCity,selectCity} from '@/lib/city';
import {Body,H2,Button} from './ui';
import {c} from '@/theme';
export function CitySelector(){const {city}=useCity();const [open,setOpen]=useState(false);const [q,setQ]=useState('');return <>
 <Pressable accessibilityRole="button" accessibilityLabel={`Cambiar ciudad: ${serviceCity(city)?.name}`} onPress={()=>{setQ('');setOpen(true);}} style={{minHeight:48,justifyContent:'center'}}><Body style={{fontSize:14}}>⌖ {serviceCity(city)?.name} ▾</Body></Pressable>
 <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><SafeAreaView style={{flex:1,backgroundColor:c.background,padding:20,gap:16}}><H2>¿Dónde necesitas el servicio?</H2><Body muted>Busca tu ciudad o cantón en Ecuador.</Body><TextInput autoFocus accessibilityLabel="Buscar ciudad o cantón" value={q} onChangeText={setQ} placeholder="Ciudad o provincia…" style={{minHeight:48,padding:12,borderWidth:1,borderColor:c.border,borderRadius:12,color:c.text}}/><FlatList data={searchServiceCities(q)} keyboardShouldPersistTaps="handled" keyExtractor={x=>x.slug} ListEmptyComponent={<Body>No encontramos esa ciudad. Prueba con el cantón.</Body>} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>{void selectCity(item.slug);setOpen(false);}} style={{paddingVertical:14,borderBottomWidth:1,borderColor:c.border}}><Body>{item.name}{city===item.slug?' ✓':''}</Body><Body muted style={{fontSize:13}}>{item.province}</Body></Pressable>}/><Body muted style={{fontSize:12}}>La disponibilidad depende de los profesionales que atienden en tu ciudad.</Body><Button label="Cerrar" variant="secondary" onPress={()=>setOpen(false)}/></SafeAreaView></Modal>
 </>;}
