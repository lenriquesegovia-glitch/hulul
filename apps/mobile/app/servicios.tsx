import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { categories, categoryImage } from '@hulul/shared';
import { BackButton, H1, Body } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { c, font } from '@/theme';
export default function Services() {
  return <SafeAreaView style={{flex:1,backgroundColor:c.background}}>
    <ScrollView contentContainerStyle={{padding:20,gap:16,paddingBottom:40}}>
      <BackButton/><H1>¿En qué te ayudamos?</H1>
      <Body muted>Elige una categoría para ver sus servicios.</Body>
      {categories.map(cat => <Pressable key={cat.slug} accessibilityRole="button" accessibilityLabel={cat.name}
        onPress={()=>router.push({pathname:'/categoria/[slug]',params:{slug:cat.slug}})}
        style={({pressed})=>({borderRadius:18,overflow:'hidden',backgroundColor:c.surface,borderWidth:1,borderColor:c.border,opacity:pressed ? 0.8 : 1})}>
        <Image source={{uri:categoryImage(cat.slug,600)}} style={{width:'100%',aspectRatio:16/7}}/>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:16,minHeight:56}}>
          <Text style={{flex:1,fontFamily:font.bodyBold,fontSize:17,color:c.text}}>{cat.name}</Text>
          <Icon name="chevronRight" size={22}/>
        </View>
      </Pressable>)}
      <Body muted>Fotos de referencia</Body>
    </ScrollView>
  </SafeAreaView>;
}
