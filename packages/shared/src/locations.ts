/** Searchable Ecuador canton catalogue, with province to disambiguate.
 * Source: https://github.com/GAumala/geografia.ec (INEC 2025 transcription), retrieved 2026-10-24.
 * Catalogue is separate from the SEO pages and from provider coverage.
 */
export interface ServiceCity {slug:string;name:string;province:string;aliases?:string[]}
export const serviceCities: ServiceCity[] = [
  {
    "slug": "camilo-ponce-enriquez",
    "name": "Camilo Ponce Enríquez",
    "province": "Azuay",
    "aliases": ["Camilo Ponce Enríquez"]
  },
  {
    "slug": "chordeleg",
    "name": "Chordeleg",
    "province": "Azuay",
    "aliases": ["Chordeleg","La Unión","Luis Galarza Orellana","Principal","San Martín de Puzhio"]
  },
  {
    "slug": "cuenca",
    "name": "Cuenca",
    "province": "Azuay",
    "aliases": ["Baños","Chaucha","Checa","Chiquintad","Cuenca","Cumbe","Llacao","Molleturo","Nulti","Octavio Cordero Palacios","Paccha","Quingeo","Ricaurte","San Joaquín","Santa Ana","Sayausí","Sidcay","Sinincay","Tarqui","Turi","Valle","Victoria del Portete"]
  },
  {
    "slug": "el-pan",
    "name": "El Pan",
    "province": "Azuay",
    "aliases": ["El Pan","San Vicente"]
  },
  {
    "slug": "giron",
    "name": "Girón",
    "province": "Azuay",
    "aliases": ["Girón","La Asunción","San Gerardo"]
  },
  {
    "slug": "guachapala",
    "name": "Guachapala",
    "province": "Azuay",
    "aliases": ["Guachapala"]
  },
  {
    "slug": "gualaceo",
    "name": "Gualaceo",
    "province": "Azuay",
    "aliases": ["Daniel Córdova Toral","Gualaceo","Jadán","Luis Cordero Vega","Mariano Moreno","Remigio Crespo Toral","San Juan","Simón Bolívar","Zhidmad"]
  },
  {
    "slug": "nabon",
    "name": "Nabón",
    "province": "Azuay",
    "aliases": ["Cochapata","El Progreso","Las Nieves","Nabón"]
  },
  {
    "slug": "ona",
    "name": "Oña",
    "province": "Azuay",
    "aliases": ["San Felipe de Oña","Susudel"]
  },
  {
    "slug": "paute",
    "name": "Paute",
    "province": "Azuay",
    "aliases": ["Bulán","Chicán","Dug Dug","El Cabo","Guarainag","Paute","San Cristóbal","Tomebamba"]
  },
  {
    "slug": "pucara",
    "name": "Pucará",
    "province": "Azuay",
    "aliases": ["Pucará","San Rafael de Sharug"]
  },
  {
    "slug": "san-fernando",
    "name": "San Fernando",
    "province": "Azuay",
    "aliases": ["Chumblín","San Fernando"]
  },
  {
    "slug": "santa-isabel",
    "name": "Santa Isabel",
    "province": "Azuay",
    "aliases": ["Abdón Calderón","El Carmen de Pijilí","San Salvador de Cañaribamba","Santa Isabel","Shaglli"]
  },
  {
    "slug": "sevilla-de-oro",
    "name": "Sevilla de Oro",
    "province": "Azuay",
    "aliases": ["Amaluza","Palmas","Sevilla de Oro"]
  },
  {
    "slug": "sigsig",
    "name": "Sígsig",
    "province": "Azuay",
    "aliases": ["Cuchil","Güel","Jima","Ludo","San Bartolomé","San José de Raranga","Sígsig"]
  },
  {
    "slug": "caluma",
    "name": "Caluma",
    "province": "Bolívar",
    "aliases": ["Caluma"]
  },
  {
    "slug": "chillanes",
    "name": "Chillanes",
    "province": "Bolívar",
    "aliases": ["Chillanes","San José del Tambo"]
  },
  {
    "slug": "chimbo",
    "name": "Chimbo",
    "province": "Bolívar",
    "aliases": ["Asunción","La Magdalena","San José de Chimbo","San Sebastián","Telimbela"]
  },
  {
    "slug": "echeandia",
    "name": "Echeandía",
    "province": "Bolívar",
    "aliases": ["Echeandía"]
  },
  {
    "slug": "guaranda",
    "name": "Guaranda",
    "province": "Bolívar",
    "aliases": ["Facundo Vela","Guaranda","Julio E. Moreno","Salinas","San Lorenzo","San Luis de Pambil","San Simón","Santa Fe","Simiátug"]
  },
  {
    "slug": "las-naves",
    "name": "Las Naves",
    "province": "Bolívar",
    "aliases": ["Las Naves"]
  },
  {
    "slug": "san-miguel",
    "name": "San Miguel",
    "province": "Bolívar",
    "aliases": ["Balsapamba","Bilován","Régulo de Mora","San Miguel","San Pablo","San Vicente","Santiago"]
  },
  {
    "slug": "azogues",
    "name": "Azogues",
    "province": "Cañar",
    "aliases": ["Azogues","Cojitambo","Guapán","Javier Loyola","Luis Cordero","Pindilig","Rivera","San Miguel","Taday"]
  },
  {
    "slug": "biblian",
    "name": "Biblián",
    "province": "Cañar",
    "aliases": ["Biblián","Jerusalén","Nazón","San Francisco de Sageo","Turupamba"]
  },
  {
    "slug": "canar",
    "name": "Cañar",
    "province": "Cañar",
    "aliases": ["Cañar","Chontamarca","Chorocopte","Ducur","General Morales","Gualleturo","Honorato Vásquez","Ingapirca","Juncal","San Antonio","Ventura","Zhud"]
  },
  {
    "slug": "deleg",
    "name": "Déleg",
    "province": "Cañar",
    "aliases": ["Déleg","Solano"]
  },
  {
    "slug": "el-tambo",
    "name": "El Tambo",
    "province": "Cañar",
    "aliases": ["El Tambo"]
  },
  {
    "slug": "la-troncal",
    "name": "La Troncal",
    "province": "Cañar",
    "aliases": ["La Troncal","Manuel J. Calle","Pancho Negro"]
  },
  {
    "slug": "suscal",
    "name": "Suscal",
    "province": "Cañar",
    "aliases": ["Suscal"]
  },
  {
    "slug": "bolivar-carchi",
    "name": "Bolívar",
    "province": "Carchi",
    "aliases": ["Bolívar","García Moreno","Los Andes","Monte Olivo","San Rafael","San Vicente de Pusir"]
  },
  {
    "slug": "espejo",
    "name": "Espejo",
    "province": "Carchi",
    "aliases": ["El Goaltal","El Ángel","La Libertad","San Isidro"]
  },
  {
    "slug": "mira",
    "name": "Mira",
    "province": "Carchi",
    "aliases": ["Concepción","Jijón y Caamaño","Juan Montalvo","Mira"]
  },
  {
    "slug": "montufar",
    "name": "Montúfar",
    "province": "Carchi",
    "aliases": ["Chitán de Navarrete","Cristóbal Colón","Fernández Salvador","La Paz","Piartal","San Gabriel"]
  },
  {
    "slug": "san-pedro-de-huaca",
    "name": "San Pedro de Huaca",
    "province": "Carchi",
    "aliases": ["Huaca","Mariscal Sucre"]
  },
  {
    "slug": "tulcan",
    "name": "Tulcán",
    "province": "Carchi",
    "aliases": ["El Carmelo","El Chical","Julio Andrade","Maldonado","Pioter","Santa Martha de Cuba","Tobar Donoso","Tufiño","Tulcán","Urbina"]
  },
  {
    "slug": "alausi",
    "name": "Alausí",
    "province": "Chimborazo",
    "aliases": ["Achupallas","Alausí","Guasuntos","Huigra","Multitud","Pistishi","Pumallacta","Sevilla","Sibambe","Tixán"]
  },
  {
    "slug": "chambo",
    "name": "Chambo",
    "province": "Chimborazo",
    "aliases": ["Chambo"]
  },
  {
    "slug": "chunchi",
    "name": "Chunchi",
    "province": "Chimborazo",
    "aliases": ["Capzol","Chunchi","Compud","Gonzol","Llagos"]
  },
  {
    "slug": "colta",
    "name": "Colta",
    "province": "Chimborazo",
    "aliases": ["Cañi","Columbe","Juan de Velasco","Santiago de Quito","Villa la Unión"]
  },
  {
    "slug": "cumanda",
    "name": "Cumandá",
    "province": "Chimborazo",
    "aliases": ["Cumandá"]
  },
  {
    "slug": "guamote",
    "name": "Guamote",
    "province": "Chimborazo",
    "aliases": ["Cebadas","Guamote","Palmira"]
  },
  {
    "slug": "guano",
    "name": "Guano",
    "province": "Chimborazo",
    "aliases": ["Guanando","Guano","Ilapo","La Providencia","San Andrés","San Gerardo","San Isidro de Patulú","San José del Chazo","Santa Fé de Galán","Valparaiso"]
  },
  {
    "slug": "pallatanga",
    "name": "Pallatanga",
    "province": "Chimborazo",
    "aliases": ["Pallatanga"]
  },
  {
    "slug": "penipe",
    "name": "Penipe",
    "province": "Chimborazo",
    "aliases": ["Bilbao","El Altar","La Candelaria","Matus","Penipe","Puela","San Antonio de Bayushig"]
  },
  {
    "slug": "riobamba",
    "name": "Riobamba",
    "province": "Chimborazo",
    "aliases": ["Cacha","Calpi","Cubijíes","Flores","Licto","Licán","Pungalá","Punín","Quimiag","Riobamba","San Juan","San Luis"]
  },
  {
    "slug": "la-mana",
    "name": "La Maná",
    "province": "Cotopaxi",
    "aliases": ["Guasaganda","La Maná","Pucayacu"]
  },
  {
    "slug": "latacunga",
    "name": "Latacunga",
    "province": "Cotopaxi",
    "aliases": ["Aláquez","Belisario Quevedo","Guaytacama","Joseguango Bajo","Latacunga","Mulaló","Once de Noviembre","Poaló","San Juan de Pastocalle","Tanicuchí","Toacaso"]
  },
  {
    "slug": "pangua",
    "name": "Pangua",
    "province": "Cotopaxi",
    "aliases": ["El Corazón","Moraspungo","Pinllopata","Ramón Campaña"]
  },
  {
    "slug": "pujili",
    "name": "Pujilí",
    "province": "Cotopaxi",
    "aliases": ["Angamarca","Guangaje","La Victoria","Pilaló","Pujilí","Tingo","Zumbahua"]
  },
  {
    "slug": "salcedo",
    "name": "Salcedo",
    "province": "Cotopaxi",
    "aliases": ["Antonio José Holguín","Cusubamba","Mulalillo","Mulliquindil","Pansaleo","San Miguel"]
  },
  {
    "slug": "saquisili",
    "name": "Saquisilí",
    "province": "Cotopaxi",
    "aliases": ["Canchagua","Chantilín","Cochapamba","Saquisilí"]
  },
  {
    "slug": "sigchos",
    "name": "Sigchos",
    "province": "Cotopaxi",
    "aliases": ["Chugchillán","Isinlivi","Las Pampas","Palo Quemado","Sigchos"]
  },
  {
    "slug": "arenillas",
    "name": "Arenillas",
    "province": "El Oro",
    "aliases": ["Arenillas","Carcabón","Chacras","La Cuca","Palmales"]
  },
  {
    "slug": "atahualpa",
    "name": "Atahualpa",
    "province": "El Oro",
    "aliases": ["Ayapamba","Cordoncillo","Milagro","Paccha","San José","San Juan de Cerro Azul"]
  },
  {
    "slug": "balsas",
    "name": "Balsas",
    "province": "El Oro",
    "aliases": ["Balsas","Bellamaría"]
  },
  {
    "slug": "chilla",
    "name": "Chilla",
    "province": "El Oro",
    "aliases": ["Chilla"]
  },
  {
    "slug": "el-guabo",
    "name": "El Guabo",
    "province": "El Oro",
    "aliases": ["Barbones","El Guabo","La Iberia","Río Bonito","Tendales"]
  },
  {
    "slug": "huaquillas",
    "name": "Huaquillas",
    "province": "El Oro",
    "aliases": ["Huaquillas"]
  },
  {
    "slug": "las-lajas",
    "name": "Las Lajas",
    "province": "El Oro",
    "aliases": ["El Paraíso","La Libertad","La Victoria","San Isidro"]
  },
  {
    "slug": "machala",
    "name": "Machala",
    "province": "El Oro",
    "aliases": ["El Retiro","Machala"]
  },
  {
    "slug": "marcabeli",
    "name": "Marcabelí",
    "province": "El Oro",
    "aliases": ["El Ingenio","Marcabelí"]
  },
  {
    "slug": "pasaje",
    "name": "Pasaje",
    "province": "El Oro",
    "aliases": ["Buenavista","Casacay","Cañaquemada","La Peaña","Pasaje","Progreso","Uzhcurrumi"]
  },
  {
    "slug": "pinas",
    "name": "Piñas",
    "province": "El Oro",
    "aliases": ["Capiro","La Bocana","Moromoro","Piedras","Piñas","San Roque","Saracay"]
  },
  {
    "slug": "portovelo",
    "name": "Portovelo",
    "province": "El Oro",
    "aliases": ["Curtincapa","Morales","Portovelo","Salatí"]
  },
  {
    "slug": "santa-rosa",
    "name": "Santa Rosa",
    "province": "El Oro",
    "aliases": ["Bellamaría","Bellavista","Jambelí","La Avanzada","San Antonio","Santa Rosa","Torata","Victoria"]
  },
  {
    "slug": "zaruma",
    "name": "Zaruma",
    "province": "El Oro",
    "aliases": ["Abañín","Arcapamba","Guanazán","Guizhaguiña","Huertas","Malvas","Muluncay Grande","Salvias","Sinsao","Zaruma"]
  },
  {
    "slug": "atacames",
    "name": "Atacames",
    "province": "Esmeraldas",
    "aliases": ["Atacames","La Unión","Súa","Tonchigüe","Tonsupa"]
  },
  {
    "slug": "eloy-alfaro",
    "name": "Eloy Alfaro",
    "province": "Esmeraldas",
    "aliases": ["Anchayacu","Atahualpa","Borbón","Colón Eloy del María","La Tola","Luis Vargas Torres","Maldonado","Pampanal de Bolívar","San Francisco de Onzole","San José de Cayapas","Santa Lucía de las Peñas","Santo Domingo de Onzole","Selva Alegre","Telembí","Timbiré","Valdez"]
  },
  {
    "slug": "esmeraldas",
    "name": "Esmeraldas",
    "province": "Esmeraldas",
    "aliases": ["Camarones","Chinca","Coronel Carlos Concha Torres","Esmeraldas","Majua","San Mateo","Tabiazo","Tachina","Vuelta Larga"]
  },
  {
    "slug": "muisne",
    "name": "Muisne",
    "province": "Esmeraldas",
    "aliases": ["Bolívar","Daule","Galera","Muisne","Quingue","San Francisco","San Gregorio","San José de Chamanga","Sálima"]
  },
  {
    "slug": "quininde",
    "name": "Quinindé",
    "province": "Esmeraldas",
    "aliases": ["Chura","Cube","La Unión","Malimpia","Rosa Zárate","Viche"]
  },
  {
    "slug": "rioverde",
    "name": "Rioverde",
    "province": "Esmeraldas",
    "aliases": ["Chontaduro","Chumundé","Lagarto","Montalvo","Rioverde","Rocafuerte"]
  },
  {
    "slug": "san-lorenzo",
    "name": "San Lorenzo",
    "province": "Esmeraldas",
    "aliases": ["5 de Junio","Alto Tambo","Ancón","Calderón","Carondelet","Concepción","Mataje","San Javier de Cachaví","San Lorenzo","Santa Rita","Tambillo","Tululbí","Urbina"]
  },
  {
    "slug": "isabela",
    "name": "Isabela",
    "province": "Galápagos",
    "aliases": ["Puerto Villamil","Tomás de Berlanga"]
  },
  {
    "slug": "san-cristobal",
    "name": "San Cristóbal",
    "province": "Galápagos",
    "aliases": ["El Progreso","Isla Santa María Floreana","Puerto Baquerizo Moreno"]
  },
  {
    "slug": "santa-cruz",
    "name": "Santa Cruz",
    "province": "Galápagos",
    "aliases": ["Bella Vista","Puerto Ayora","Santa Rosa"]
  },
  {
    "slug": "alfredo-baquerizo-moreno-jujan",
    "name": "Alfredo Baquerizo Moreno (Juján)",
    "province": "Guayas",
    "aliases": ["Alfredo Baquerizo Moreno (Juján)"]
  },
  {
    "slug": "balao",
    "name": "Balao",
    "province": "Guayas",
    "aliases": ["Balao"]
  },
  {
    "slug": "balzar",
    "name": "Balzar",
    "province": "Guayas",
    "aliases": ["Balzar"]
  },
  {
    "slug": "colimes",
    "name": "Colimes",
    "province": "Guayas",
    "aliases": ["Colimes","San Jacinto"]
  },
  {
    "slug": "coronel-marcelino-mariduena",
    "name": "Coronel Marcelino Maridueña",
    "province": "Guayas",
    "aliases": ["Coronel Marcelino Maridueña"]
  },
  {
    "slug": "daule",
    "name": "Daule",
    "province": "Guayas",
    "aliases": ["Daule","Juan Bautista Aguirre","Laurel","Limonal","Los Lojas"]
  },
  {
    "slug": "duran",
    "name": "Durán",
    "province": "Guayas",
    "aliases": ["Eloy Alfaro"]
  },
  {
    "slug": "el-empalme",
    "name": "El Empalme",
    "province": "Guayas",
    "aliases": ["El Rosario","Guayas","Velasco Ibarra"]
  },
  {
    "slug": "el-triunfo",
    "name": "El Triunfo",
    "province": "Guayas",
    "aliases": ["El Triunfo"]
  },
  {
    "slug": "general-antonio-elizalde",
    "name": "General  Antonio Elizalde",
    "province": "Guayas",
    "aliases": ["General Antonio Elizalde"]
  },
  {
    "slug": "guayaquil",
    "name": "Guayaquil",
    "province": "Guayas",
    "aliases": ["Guayaquil","Juan Gómez Rendón","Morro","Posorja","Puná","Tenguel"]
  },
  {
    "slug": "isidro-ayora",
    "name": "Isidro Ayora",
    "province": "Guayas",
    "aliases": ["Isidro Ayora"]
  },
  {
    "slug": "lomas-de-sargentillo",
    "name": "Lomas de Sargentillo",
    "province": "Guayas",
    "aliases": ["Lomas de Sargentillo"]
  },
  {
    "slug": "milagro",
    "name": "Milagro",
    "province": "Guayas",
    "aliases": ["Chobo","Mariscal Sucre","Milagro","Roberto Astudillo"]
  },
  {
    "slug": "naranjal",
    "name": "Naranjal",
    "province": "Guayas",
    "aliases": ["Jesús María","Naranjal","San Carlos","Santa Rosa de Flandes","Taura"]
  },
  {
    "slug": "naranjito",
    "name": "Naranjito",
    "province": "Guayas",
    "aliases": ["Naranjito"]
  },
  {
    "slug": "nobol",
    "name": "Nobol",
    "province": "Guayas",
    "aliases": ["Narcisa de Jesús"]
  },
  {
    "slug": "palestina",
    "name": "Palestina",
    "province": "Guayas",
    "aliases": ["Palestina"]
  },
  {
    "slug": "pedro-carbo",
    "name": "Pedro Carbo",
    "province": "Guayas",
    "aliases": ["Pedro Carbo","Sabanilla","Valle de la Virgen"]
  },
  {
    "slug": "playas",
    "name": "Playas",
    "province": "Guayas",
    "aliases": ["General Villamil"]
  },
  {
    "slug": "salitre",
    "name": "Salitre",
    "province": "Guayas",
    "aliases": ["El Salitre","General Vernaza","Junquillal","La Victoria"]
  },
  {
    "slug": "samborondon",
    "name": "Samborondón",
    "province": "Guayas",
    "aliases": ["Samborondón","Tarifa"]
  },
  {
    "slug": "san-jacinto-de-yaguachi",
    "name": "San Jacinto de Yaguachi",
    "province": "Guayas",
    "aliases": ["General Pedro J. Montero","San Jacinto de Yaguachi","Virgen de Fátima","Yaguachi Viejo"]
  },
  {
    "slug": "santa-lucia",
    "name": "Santa Lucía",
    "province": "Guayas",
    "aliases": ["Santa Lucía"]
  },
  {
    "slug": "simon-bolivar",
    "name": "Simón Bolívar",
    "province": "Guayas",
    "aliases": ["Coronel Lorenzo de Garaycoa","Simón Bolívar"]
  },
  {
    "slug": "antonio-ante",
    "name": "Antonio Ante",
    "province": "Imbabura",
    "aliases": ["Atuntaqui","Imbaya","San Francisco de Natabuela","San José de Chaltura","San Roque"]
  },
  {
    "slug": "cotacachi",
    "name": "Cotacachi",
    "province": "Imbabura",
    "aliases": ["Apuela","Cotacachi","García Moreno","Imantag","Peñaherrera","Plaza Gutiérrez","Quiroga","Seis de Julio de Cuellaje","Vacas Galindo"]
  },
  {
    "slug": "ibarra",
    "name": "Ibarra",
    "province": "Imbabura",
    "aliases": ["Ambuquí","Angochagua","La Carolina","La Esperanza","Lita","Salinas","San Antonio","San Miguel de Ibarra"]
  },
  {
    "slug": "otavalo",
    "name": "Otavalo",
    "province": "Imbabura",
    "aliases": ["Dr. Miguel Egas Cabezas","Eugenio Espejo","González Suárez","Otavalo","Pataquí","San José de Quichinche","San Juan de Ilumán","San Pablo","San Rafael","Selva Alegre"]
  },
  {
    "slug": "pimampiro",
    "name": "Pimampiro",
    "province": "Imbabura",
    "aliases": ["Chugá","Mariano Acosta","Pimampiro","San Francisco de Sigsipamba"]
  },
  {
    "slug": "san-miguel-de-urcuqui",
    "name": "San Miguel de Urcuquí",
    "province": "Imbabura",
    "aliases": ["Cahuasquí","La Merced de Buenos Aires","Pablo Arenas","San Blas","Tumbabiro","Urcuquí"]
  },
  {
    "slug": "calvas",
    "name": "Calvas",
    "province": "Loja",
    "aliases": ["Cariamanga","Colaisaca","El Lucero","Sanguillín","Utuana"]
  },
  {
    "slug": "catamayo",
    "name": "Catamayo",
    "province": "Loja",
    "aliases": ["Catamayo","El Tambo","Guayquichuma","San Pedro de la Bendita","Zambi"]
  },
  {
    "slug": "celica",
    "name": "Celica",
    "province": "Loja",
    "aliases": ["Celica","Cruzpamba","Pózul","Sabanilla","Teniente Maximiliano Rodríguez Loaiza"]
  },
  {
    "slug": "chaguarpamba",
    "name": "Chaguarpamba",
    "province": "Loja",
    "aliases": ["Amarillos","Buenavista","Chaguarpamba","El Rosario","Santa Rufina"]
  },
  {
    "slug": "espindola",
    "name": "Espíndola",
    "province": "Loja",
    "aliases": ["27 de Abril","Amaluza","Bellavista","El Airo","El Ingenio","Jimbura","Santa Teresita"]
  },
  {
    "slug": "gonzanama",
    "name": "Gonzanamá",
    "province": "Loja",
    "aliases": ["Changaimina","Gonzanamá","Nambacola","Purunuma","Sacapalca"]
  },
  {
    "slug": "loja",
    "name": "Loja",
    "province": "Loja",
    "aliases": ["Chantaco","Chuquiribamba","El Cisne","Gualel","Jimbilla","Loja","Malacatos","Quinara","San Lucas","San Pedro de Vilcabamba","Santiago","Taquil","Vilcabamba","Yangana"]
  },
  {
    "slug": "macara",
    "name": "Macará",
    "province": "Loja",
    "aliases": ["La Victoria","Larama","Macará","Sabiango"]
  },
  {
    "slug": "olmedo-loja",
    "name": "Olmedo",
    "province": "Loja",
    "aliases": ["La Tingue","Olmedo"]
  },
  {
    "slug": "paltas",
    "name": "Paltas",
    "province": "Loja",
    "aliases": ["Cangonamá","Casanga","Catacocha","Guachanamá","Lauro Guerrero","Orianga","San Antonio","Yamana"]
  },
  {
    "slug": "pindal",
    "name": "Pindal",
    "province": "Loja",
    "aliases": ["12 de Diciembre","Chaquinal","Milagros","Pindal"]
  },
  {
    "slug": "puyango",
    "name": "Puyango",
    "province": "Loja",
    "aliases": ["Alamor","Ciano","El Arenal","El Limo","Mercadillo","Vicentino"]
  },
  {
    "slug": "quilanga",
    "name": "Quilanga",
    "province": "Loja",
    "aliases": ["Fundochamba","Quilanga","San Antonio de las Aradas"]
  },
  {
    "slug": "saraguro",
    "name": "Saraguro",
    "province": "Loja",
    "aliases": ["El Paraíso de Celen","El Tablón","Lluzhapa","Manú","San Antonio de Qumbe","San Pablo de Tenta","San Sebastián de Yúluc","Saraguro","Selva Alegre","Sumaypamba","Urdaneta"]
  },
  {
    "slug": "sozoranga",
    "name": "Sozoranga",
    "province": "Loja",
    "aliases": ["Nueva Fátima","Sozoranga","Tacamoros"]
  },
  {
    "slug": "zapotillo",
    "name": "Zapotillo",
    "province": "Loja",
    "aliases": ["Bolaspamba","Cazaderos","Garzareal","Limones","Mangahurco","Paletillas","Zapotillo"]
  },
  {
    "slug": "baba",
    "name": "Baba",
    "province": "Los Ríos",
    "aliases": ["Baba","Guare","Isla de Bejucal"]
  },
  {
    "slug": "babahoyo",
    "name": "Babahoyo",
    "province": "Los Ríos",
    "aliases": ["Babahoyo","Caracol","Febres Cordero","La Unión","Pimocha"]
  },
  {
    "slug": "buena-fe",
    "name": "Buena Fe",
    "province": "Los Ríos",
    "aliases": ["Patricia Pilar","San Jacinto de Buena Fe"]
  },
  {
    "slug": "mocache",
    "name": "Mocache",
    "province": "Los Ríos",
    "aliases": ["Mocache"]
  },
  {
    "slug": "montalvo",
    "name": "Montalvo",
    "province": "Los Ríos",
    "aliases": ["La Esmeralda","Montalvo"]
  },
  {
    "slug": "palenque",
    "name": "Palenque",
    "province": "Los Ríos",
    "aliases": ["Palenque"]
  },
  {
    "slug": "puebloviejo",
    "name": "Puebloviejo",
    "province": "Los Ríos",
    "aliases": ["Puebloviejo","Puerto Pechiche","San Juan"]
  },
  {
    "slug": "quevedo",
    "name": "Quevedo",
    "province": "Los Ríos",
    "aliases": ["La Esperanza","Quevedo","San Carlos"]
  },
  {
    "slug": "quinsaloma",
    "name": "Quinsaloma",
    "province": "Los Ríos",
    "aliases": ["Quinsaloma"]
  },
  {
    "slug": "urdaneta",
    "name": "Urdaneta",
    "province": "Los Ríos",
    "aliases": ["Catarama","Ricaurte"]
  },
  {
    "slug": "valencia",
    "name": "Valencia",
    "province": "Los Ríos",
    "aliases": ["Valencia"]
  },
  {
    "slug": "ventanas",
    "name": "Ventanas",
    "province": "Los Ríos",
    "aliases": ["Chacarita","Los Ángeles","Ventanas","Zapotal"]
  },
  {
    "slug": "vinces",
    "name": "Vinces",
    "province": "Los Ríos",
    "aliases": ["Antonio Sotomayor","Vinces"]
  },
  {
    "slug": "24-de-mayo",
    "name": "24 de Mayo",
    "province": "Manabí",
    "aliases": ["Arquitecto Sixto Durán Ballén","Bellavista","Noboa","Sucre"]
  },
  {
    "slug": "bolivar-manabi",
    "name": "Bolívar",
    "province": "Manabí",
    "aliases": ["Calceta","Membrillo","Quiroga"]
  },
  {
    "slug": "chone",
    "name": "Chone",
    "province": "Manabí",
    "aliases": ["Boyacá","Canuto","Chibunga","Chone","Convento","Eloy Alfaro","Ricaurte","San Antonio"]
  },
  {
    "slug": "el-carmen",
    "name": "El Carmen",
    "province": "Manabí",
    "aliases": ["El Carmen","El Paraíso la 14","San Pedro de Suma","Santa María","Wilfrido Loor Moreira"]
  },
  {
    "slug": "flavio-alfaro",
    "name": "Flavio Alfaro",
    "province": "Manabí",
    "aliases": ["Flavio Alfaro","San Francisco de Novillo","Zapallo"]
  },
  {
    "slug": "jama",
    "name": "Jama",
    "province": "Manabí",
    "aliases": ["Jama"]
  },
  {
    "slug": "jaramijo",
    "name": "Jaramijó",
    "province": "Manabí",
    "aliases": ["Jaramijó"]
  },
  {
    "slug": "jipijapa",
    "name": "Jipijapa",
    "province": "Manabí",
    "aliases": ["América","El Anegado","Jipijapa","Julcuy","La Unión","Membrillal","Pedro Pablo Gómez","Puerto Cayo"]
  },
  {
    "slug": "junin",
    "name": "Junín",
    "province": "Manabí",
    "aliases": ["Junín"]
  },
  {
    "slug": "manta",
    "name": "Manta",
    "province": "Manabí",
    "aliases": ["Manta","San Lorenzo","Santa Marianita"]
  },
  {
    "slug": "montecristi",
    "name": "Montecristi",
    "province": "Manabí",
    "aliases": ["La Pila","Montecristi"]
  },
  {
    "slug": "olmedo-manabi",
    "name": "Olmedo",
    "province": "Manabí",
    "aliases": ["Olmedo"]
  },
  {
    "slug": "pajan",
    "name": "Paján",
    "province": "Manabí",
    "aliases": ["Campozano","Cascol","Guale","Lascano","Paján"]
  },
  {
    "slug": "pedernales",
    "name": "Pedernales",
    "province": "Manabí",
    "aliases": ["Atahualpa","Cojimíes","Diez de Agosto","Pedernales"]
  },
  {
    "slug": "pichincha",
    "name": "Pichincha",
    "province": "Manabí",
    "aliases": ["Barraganete","Pichincha","San Sebastián"]
  },
  {
    "slug": "portoviejo",
    "name": "Portoviejo",
    "province": "Manabí",
    "aliases": ["Abdón Calderón","Alhajuela","Chirijos","Crucita","Portoviejo","Pueblo Nuevo","Riochico","San Plácido"]
  },
  {
    "slug": "puerto-lopez",
    "name": "Puerto López",
    "province": "Manabí",
    "aliases": ["Machalilla","Puerto López","Salango"]
  },
  {
    "slug": "rocafuerte",
    "name": "Rocafuerte",
    "province": "Manabí",
    "aliases": ["Rocafuerte","Sosote"]
  },
  {
    "slug": "san-vicente",
    "name": "San Vicente",
    "province": "Manabí",
    "aliases": ["Canoa","San Vicente"]
  },
  {
    "slug": "santa-ana",
    "name": "Santa Ana",
    "province": "Manabí",
    "aliases": ["Ayacucho","Honorato Vásquez","La Unión","San Pablo","Santa Ana de Vuelta Larga"]
  },
  {
    "slug": "sucre",
    "name": "Sucre",
    "province": "Manabí",
    "aliases": ["Bahía de Caráquez","Charapotó","San Isidro"]
  },
  {
    "slug": "tosagua",
    "name": "Tosagua",
    "province": "Manabí",
    "aliases": ["Bachillero","Tosagua","Ángel Pedro Giler"]
  },
  {
    "slug": "gualaquiza",
    "name": "Gualaquiza",
    "province": "Morona Santiago",
    "aliases": ["Amazonas","Bermejos","Bomboíza","Chigüinda","El Ideal","El Rosario","Gualaquiza","Nueva Tarqui","San Miguel de Cuyes"]
  },
  {
    "slug": "huamboya",
    "name": "Huamboya",
    "province": "Morona Santiago",
    "aliases": ["Chiguaza","Huamboya"]
  },
  {
    "slug": "limon-indanza",
    "name": "Limón Indanza",
    "province": "Morona Santiago",
    "aliases": ["General Leonidas Plaza Gutiérrez","Indanza","San Antonio","San Miguel de Conchay","Santa Susana de Chiviaza","Yunganza"]
  },
  {
    "slug": "logrono",
    "name": "Logroño",
    "province": "Morona Santiago",
    "aliases": ["Logroño","Shimpis","Yaupi"]
  },
  {
    "slug": "morona",
    "name": "Morona",
    "province": "Morona Santiago",
    "aliases": ["Alshi","Cuchaentza","General Proaño","Macas","Río Blanco","San Isidro","Sinaí","Zona en Estudio Interparroquial Sinaí-cuchaentza","Zuña"]
  },
  {
    "slug": "pablo-sexto",
    "name": "Pablo Sexto",
    "province": "Morona Santiago",
    "aliases": ["Pablo Sexto"]
  },
  {
    "slug": "palora",
    "name": "Palora",
    "province": "Morona Santiago",
    "aliases": ["16 de Agosto","Arapicos","Cumandá","Palora","Sangay"]
  },
  {
    "slug": "san-juan-bosco",
    "name": "San Juan Bosco",
    "province": "Morona Santiago",
    "aliases": ["Pan de Azúcar","San Carlos de Limón","San Jacinto de Wakambeis","San Juan Bosco","Santiago de Pananza"]
  },
  {
    "slug": "santiago",
    "name": "Santiago",
    "province": "Morona Santiago",
    "aliases": ["Chupianza","Copal","Patuca","San Francisco de Chinimbimi","San Luis de el Acho","Santiago de Méndez","Tayuza"]
  },
  {
    "slug": "sevilla-don-bosco",
    "name": "Sevilla Don Bosco",
    "province": "Morona Santiago",
    "aliases": ["Sevilla Don Bosco"]
  },
  {
    "slug": "sucua",
    "name": "Sucúa",
    "province": "Morona Santiago",
    "aliases": ["Asunción","Huambi","Santa Marianita de Jesús","Sucúa"]
  },
  {
    "slug": "taisha",
    "name": "Taisha",
    "province": "Morona Santiago",
    "aliases": ["Huasaga","Macuma","Pumpuentsa","Taisha","Tuutinentsa"]
  },
  {
    "slug": "tiwintza",
    "name": "Tiwintza",
    "province": "Morona Santiago",
    "aliases": ["San José de Morona","Santiago"]
  },
  {
    "slug": "archidona",
    "name": "Archidona",
    "province": "Napo",
    "aliases": ["Archidona","Cotundo","Hatun Sumaku","San Pablo de Ushpayacu"]
  },
  {
    "slug": "carlos-julio-arosemena-tola",
    "name": "Carlos Julio Arosemena Tola",
    "province": "Napo",
    "aliases": ["Carlos Julio Arosemena Tola"]
  },
  {
    "slug": "el-chaco",
    "name": "El Chaco",
    "province": "Napo",
    "aliases": ["El Chaco","Gonzalo Díaz de Pineda","Linares","Oyacachi","Santa Rosa","Sardinas"]
  },
  {
    "slug": "quijos",
    "name": "Quijos",
    "province": "Napo",
    "aliases": ["Baeza","Cosanga","Cuyuja","Papallacta","San Francisco de Borja","Sumaco"]
  },
  {
    "slug": "tena",
    "name": "Tena",
    "province": "Napo",
    "aliases": ["Ahuano","Chontapunta","Pano","Puerto Misahuallí","Puerto Napo","San Juan de Muyuna","Tena","Tálag"]
  },
  {
    "slug": "aguarico",
    "name": "Aguarico",
    "province": "Orellana",
    "aliases": ["Capitán Augusto Rivadeneyra","Cononaco","Nuevo Rocafuerte","Santa María de Huiririma","Yasuní"]
  },
  {
    "slug": "francisco-de-orellana",
    "name": "Francisco de Orellana",
    "province": "Orellana",
    "aliases": ["Alejandro Labaka","Dayuma","El Coca","El Dorado","El Edén","García Moreno","Inés Arango","La Belleza","Nuevo Paraíso","San José de Guayusa","San Luis de Armenia","Taracoa"]
  },
  {
    "slug": "la-joya-de-los-sachas",
    "name": "La Joya de los Sachas",
    "province": "Orellana",
    "aliases": ["Enokanqui","La Joya de los Sachas","Lago San Pedro","Pompeya","Rumipamba","San Carlos","San Sebastián del Coca","Tres de Noviembre","Unión Milagreña"]
  },
  {
    "slug": "loreto",
    "name": "Loreto",
    "province": "Orellana",
    "aliases": ["Loreto","Puerto Murialdo","San José de Dahuano","San José de Payamino","San Vicente de Huaticocha","Ávila"]
  },
  {
    "slug": "arajuno",
    "name": "Arajuno",
    "province": "Pastaza",
    "aliases": ["Arajuno","Curaray"]
  },
  {
    "slug": "mera",
    "name": "Mera",
    "province": "Pastaza",
    "aliases": ["Madre Tierra","Mera","Shell"]
  },
  {
    "slug": "pastaza",
    "name": "Pastaza",
    "province": "Pastaza",
    "aliases": ["Canelos","Diez de Agosto","El Triunfo","Fátima","Montalvo","Pomona","Puyo","Río Corrientes","Río Tigre","Sarayacu","Simón Bolívar","Tarqui","Teniente Hugo Ortiz","Veracruz"]
  },
  {
    "slug": "santa-clara",
    "name": "Santa Clara",
    "province": "Pastaza",
    "aliases": ["San José","Santa Clara"]
  },
  {
    "slug": "cayambe",
    "name": "Cayambe",
    "province": "Pichincha",
    "aliases": ["Ascázubi","Cangahua","Cayambe","Juan Montalvo","Olmedo","Otón","San José de Ayora","Santa Rosa de Cuzubamba"]
  },
  {
    "slug": "mejia",
    "name": "Mejía",
    "province": "Pichincha",
    "aliases": ["Aloag","Aloasí","Cutuglahua","El Chaupi","Machachi","Manuel Cornejo Astorga","Tambillo","Uyumbicho"]
  },
  {
    "slug": "pedro-moncayo",
    "name": "Pedro Moncayo",
    "province": "Pichincha",
    "aliases": ["La Esperanza","Malchinguí","Tabacundo","Tocachi","Tupigachi"]
  },
  {
    "slug": "pedro-vicente-maldonado",
    "name": "Pedro Vicente Maldonado",
    "province": "Pichincha",
    "aliases": ["Pedro Vicente Maldonado"]
  },
  {
    "slug": "puerto-quito",
    "name": "Puerto Quito",
    "province": "Pichincha",
    "aliases": ["Puerto Quito"]
  },
  {
    "slug": "quito",
    "name": "Quito",
    "province": "Pichincha",
    "aliases": ["Alangasí","Amaguaña","Atahualpa","Calacalí","Calderón","Chavezpamba","Checa","Conocoto","Cumbayá","El Quinche","Gualea","Guangopolo","Guayllabamba","La Merced","Llano Chico","Lloa","Nanegal","Nanegalito","Nayón","Nono","Pacto","Perucho","Pifo","Pomasqui","Puembo","Puéllaro","Píntag","Quito","San Antonio","San José de Minas","Tababela","Tumbaco","Yaruquí","Zámbiza"]
  },
  {
    "slug": "ruminahui",
    "name": "Rumiñahui",
    "province": "Pichincha",
    "aliases": ["Cotogchoa","Rumipamba","Sangolquí"]
  },
  {
    "slug": "san-miguel-de-los-bancos",
    "name": "San Miguel de los Bancos",
    "province": "Pichincha",
    "aliases": ["Mindo","San Miguel de los Bancos"]
  },
  {
    "slug": "la-libertad",
    "name": "La Libertad",
    "province": "Santa Elena",
    "aliases": ["La Libertad"]
  },
  {
    "slug": "salinas",
    "name": "Salinas",
    "province": "Santa Elena",
    "aliases": ["Anconcito","José Luis Tamayo","Salinas"]
  },
  {
    "slug": "santa-elena",
    "name": "Santa Elena",
    "province": "Santa Elena",
    "aliases": ["Atahualpa","Chanduy","Colonche","Manglaralto","San José de Ancón","Santa Elena","Simón Bolívar"]
  },
  {
    "slug": "la-concordia",
    "name": "La Concordia",
    "province": "Santo Domingo de los Tsáchilas",
    "aliases": ["La Concordia","La Villegas","Monterrey","Plan Piloto"]
  },
  {
    "slug": "santo-domingo",
    "name": "Santo Domingo",
    "province": "Santo Domingo de los Tsáchilas",
    "aliases": ["Alluriquín","El Esfuerzo","Luz de América","Puerto Limón","San Jacinto del Búa","Santa María del Toachi","Santo Domingo de los Colorados","Valle Hermoso"]
  },
  {
    "slug": "cascales",
    "name": "Cascales",
    "province": "Sucumbíos",
    "aliases": ["El Dorado de Cascales","Nueva Troncal","Santa Rosa de Sucumbíos","Sevilla"]
  },
  {
    "slug": "cuyabeno",
    "name": "Cuyabeno",
    "province": "Sucumbíos",
    "aliases": ["Aguas Negras","Cuyabeno","Tarapoa"]
  },
  {
    "slug": "gonzalo-pizarro",
    "name": "Gonzalo Pizarro",
    "province": "Sucumbíos",
    "aliases": ["El Reventador","Gonzalo Pizarro","Lumbaquí","Puerto Libre"]
  },
  {
    "slug": "lago-agrio",
    "name": "Lago Agrio",
    "province": "Sucumbíos",
    "aliases": ["10 de Agosto","Dureno","El Eno","General Farfán","Jambelí","Nueva Loja","Pacayacu","Santa Cecilia"]
  },
  {
    "slug": "putumayo",
    "name": "Putumayo",
    "province": "Sucumbíos",
    "aliases": ["Palma Roja","Puerto Bolívar","Puerto Rodríguez","Puerto el Carmen de Putumayo","Sansahuari","Santa Elena"]
  },
  {
    "slug": "shushufindi",
    "name": "Shushufindi",
    "province": "Sucumbíos",
    "aliases": ["La Magdalena","La Primavera","Limoncocha","Pañacocha","San Pedro de los Cofánes","San Roque","Shushufindi","Siete de Julio"]
  },
  {
    "slug": "sucumbios",
    "name": "Sucumbíos",
    "province": "Sucumbíos",
    "aliases": ["El Playón de San Francisco","La Bonita","La Sofía","Rosa Florida","Santa Bárbara"]
  },
  {
    "slug": "ambato",
    "name": "Ambato",
    "province": "Tungurahua",
    "aliases": ["Ambatillo","Ambato","Atahualpa","Augusto N. Martínez","Constantino Fernández","Cunchibamba","Huachi Grande","Izamba","Juan Benigno Vela","Montalvo","Pasa","Picaihua","Pilagüín","Quisapincha","San Bartolomé de Pinllo","San Fernando","Santa Rosa","Totoras","Unamuncho"]
  },
  {
    "slug": "banos-de-agua-santa",
    "name": "Baños de Agua Santa",
    "province": "Tungurahua",
    "aliases": ["Baños","Lligua","Río Negro","Río Verde","Ulba"]
  },
  {
    "slug": "cevallos",
    "name": "Cevallos",
    "province": "Tungurahua",
    "aliases": ["Cevallos"]
  },
  {
    "slug": "mocha",
    "name": "Mocha",
    "province": "Tungurahua",
    "aliases": ["Mocha","Pinguilí"]
  },
  {
    "slug": "patate",
    "name": "Patate",
    "province": "Tungurahua",
    "aliases": ["El Triunfo","Los Andes","Patate","Sucre"]
  },
  {
    "slug": "quero",
    "name": "Quero",
    "province": "Tungurahua",
    "aliases": ["Quero","Rumipamba","Yanayacu Mochapata"]
  },
  {
    "slug": "san-pedro-de-pelileo",
    "name": "San Pedro de Pelileo",
    "province": "Tungurahua",
    "aliases": ["Benítez","Bolívar","Chiquicha","Cotaló","El Rosario","García Moreno","Guambaló","Pelileo","Salasaca"]
  },
  {
    "slug": "santiago-de-pillaro",
    "name": "Santiago de Píllaro",
    "province": "Tungurahua",
    "aliases": ["Baquerizo Moreno","Emilio María Terán","Marcos Espinel","Presidente Urbina","Píllaro","San Andrés","San José de Poaló","San Miguelito"]
  },
  {
    "slug": "tisaleo",
    "name": "Tisaleo",
    "province": "Tungurahua",
    "aliases": ["Quinchicoto","Tisaleo"]
  },
  {
    "slug": "centinela-del-condor",
    "name": "Centinela del Cóndor",
    "province": "Zamora Chinchipe",
    "aliases": ["Panguintza","Triunfo Dorado","Zumbi"]
  },
  {
    "slug": "chinchipe",
    "name": "Chinchipe",
    "province": "Zamora Chinchipe",
    "aliases": ["Chito","El Chorro","La Chonta","Pucapamba","San Andrés","Zumba"]
  },
  {
    "slug": "el-pangui",
    "name": "El Pangui",
    "province": "Zamora Chinchipe",
    "aliases": ["El Guisme","El Pangui","Pachicutza","Tundayme"]
  },
  {
    "slug": "nangaritza",
    "name": "Nangaritza",
    "province": "Zamora Chinchipe",
    "aliases": ["Guayzimi","Nankais","Nuevo Paraíso","Zurmi"]
  },
  {
    "slug": "palanda",
    "name": "Palanda",
    "province": "Zamora Chinchipe",
    "aliases": ["El Porvenir del Carmen","La Canela","Palanda","San Francisco del Vergel","Valladolid"]
  },
  {
    "slug": "paquisha",
    "name": "Paquisha",
    "province": "Zamora Chinchipe",
    "aliases": ["Bellavista","Nuevo Quito","Paquisha"]
  },
  {
    "slug": "yacuambi",
    "name": "Yacuambi",
    "province": "Zamora Chinchipe",
    "aliases": ["28 de Mayo","La Paz","Tutupali"]
  },
  {
    "slug": "yantzaza",
    "name": "Yantzaza",
    "province": "Zamora Chinchipe",
    "aliases": ["Chicaña","Los Encuentros","Yantzaza"]
  },
  {
    "slug": "zamora",
    "name": "Zamora",
    "province": "Zamora Chinchipe",
    "aliases": ["Cumbaratza","Guadalupe","Imbana","Sabanilla","San Carlos de las Minas","Timbara","Zamora"]
  }
];
export const normalizeCitySearch=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function searchServiceCities(q:string) {const term=normalizeCitySearch(q);return serviceCities.filter(c=>normalizeCitySearch(c.name+' '+c.province+' '+(c.aliases||[]).join(' ')).includes(term)).sort((a,b)=>{const featured=['guayaquil','samborondon','daule'];return (featured.includes(a.slug)?-1:0)-(featured.includes(b.slug)?-1:0)||a.name.localeCompare(b.name,'es');});}
export function serviceCity(slug:string) {return serviceCities.find(c=>c.slug===slug);}
