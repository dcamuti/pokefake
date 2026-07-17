'use strict';
/* ================================================================
   VALMORA — gioco 2D in stile GBA, creato con Claude
   Motore completo: overworld, battaglie a turni, cattura,
   evoluzioni, 8 palestre, Lega, Pokédex-like, salvataggio.
   ================================================================ */

// ---------- PRNG con seed (mulberry32) ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const R = ()=>Math.random();
const ri = (a,b)=>a+Math.floor(R()*(b-a+1));

// ---------- Tipi ----------
const TYPES = {
 NOR:{n:'Normale', c:'#a8a878'}, FUO:{n:'Fuoco', c:'#f08030'}, ACQ:{n:'Acqua', c:'#6890f0'},
 ERB:{n:'Erba', c:'#78c850'}, ELE:{n:'Elettro', c:'#f8d030'}, TER:{n:'Terra', c:'#e0c068'},
 VOL:{n:'Volante', c:'#a890f0'}, INS:{n:'Insetto', c:'#a8b820'}, ROC:{n:'Roccia', c:'#b8a038'},
 SPE:{n:'Spettro', c:'#705898'}, PSI:{n:'Psico', c:'#f85888'}, LOT:{n:'Lotta', c:'#c03028'},
 GHI:{n:'Ghiaccio', c:'#98d8d8'}, DRA:{n:'Drago', c:'#7038f8'}, VEL:{n:'Veleno', c:'#a040a0'}
};
// tabella efficacia: CHART[att][dif] = molt (default 1)
const CHART = {
 NOR:{ROC:.5, SPE:0},
 FUO:{ERB:2, INS:2, GHI:2, FUO:.5, ACQ:.5, ROC:.5, DRA:.5},
 ACQ:{FUO:2, TER:2, ROC:2, ACQ:.5, ERB:.5, DRA:.5},
 ERB:{ACQ:2, TER:2, ROC:2, FUO:.5, ERB:.5, VOL:.5, INS:.5, VEL:.5, DRA:.5},
 ELE:{ACQ:2, VOL:2, ERB:.5, ELE:.5, DRA:.5, TER:0},
 TER:{FUO:2, ELE:2, ROC:2, VEL:2, ERB:.5, INS:.5, VOL:0},
 VOL:{ERB:2, INS:2, LOT:2, ELE:.5, ROC:.5},
 INS:{ERB:2, PSI:2, FUO:.5, LOT:.5, VOL:.5, SPE:.5, VEL:.5},
 ROC:{FUO:2, GHI:2, VOL:2, INS:2, LOT:.5, TER:.5},
 SPE:{SPE:2, PSI:2, NOR:0},
 PSI:{LOT:2, VEL:2, PSI:.5},
 LOT:{NOR:2, ROC:2, GHI:2, VOL:.5, PSI:.5, INS:.5, VEL:.5, SPE:0},
 GHI:{ERB:2, TER:2, VOL:2, DRA:2, FUO:.5, ACQ:.5, GHI:.5},
 DRA:{DRA:2},
 VEL:{ERB:2, VEL:.5, TER:.5, ROC:.5, SPE:.5}
};
function typeMult(att, defTypes){let m=1;for(const d of defTypes){const r=CHART[att]&&CHART[att][d];if(r!==undefined)m*=r;}return m;}

// ---------- Mosse ----------
// p=potenza (0=di stato), a=precisione (0=infallibile), pp, fx=effetto, pr=priorità, hc=critico alto, hits, drain
const MOVES = {
 graffio:{n:'Graffio',t:'NOR',p:40,a:100,pp:35},
 azione:{n:'Azione',t:'NOR',p:40,a:100,pp:35},
 ruggito:{n:'Ruggito',t:'NOR',p:0,a:100,pp:40,fx:{stat:'atk',d:-1,tgt:'foe'}},
 fortifica:{n:'Fortifica',t:'NOR',p:0,a:0,pp:30,fx:{stat:'def',d:1,tgt:'self'}},
 rapido:{n:'Attacco Rapido',t:'NOR',p:40,a:100,pp:30,pr:1},
 morso:{n:'Morso',t:'NOR',p:60,a:100,pp:25},
 cornata:{n:'Cornata',t:'NOR',p:65,a:100,pp:25},
 bodyslam:{n:'Corposcontro',t:'NOR',p:85,a:100,pp:15,fx:{st:'PAR',ch:.2}},
 iperraggio:{n:'Iperraggio',t:'NOR',p:130,a:90,pp:5},
 ripresa:{n:'Ripresa',t:'NOR',p:0,a:0,pp:10,fx:{heal:.5}},
 affilatoio:{n:'Affilatoio',t:'NOR',p:0,a:0,pp:30,fx:{stat:'atk',d:1,tgt:'self'}},
 braciere:{n:'Braciere',t:'FUO',p:40,a:100,pp:25,fx:{st:'BRN',ch:.1}},
 turbofuoco:{n:'Turbofuoco',t:'FUO',p:60,a:100,pp:20,fx:{st:'BRN',ch:.1}},
 lanciafiamme:{n:'Lanciafiamme',t:'FUO',p:90,a:100,pp:15,fx:{st:'BRN',ch:.1}},
 fuocobomba:{n:'Fuocobomba',t:'FUO',p:110,a:85,pp:5,fx:{st:'BRN',ch:.3}},
 pistolacqua:{n:'Pistolacqua',t:'ACQ',p:40,a:100,pp:25},
 bolla:{n:'Bolla',t:'ACQ',p:40,a:100,pp:30,fx:{stat:'spe',d:-1,tgt:'foe',ch:.1}},
 idropulsar:{n:'Idropulsar',t:'ACQ',p:65,a:100,pp:20},
 surf:{n:'Surf',t:'ACQ',p:90,a:100,pp:15},
 idropompa:{n:'Idropompa',t:'ACQ',p:110,a:80,pp:5},
 frustata:{n:'Frustata',t:'ERB',p:45,a:100,pp:25},
 foglielama:{n:'Foglielama',t:'ERB',p:55,a:95,pp:25,hc:1},
 assorbi:{n:'Assorbimento',t:'ERB',p:40,a:100,pp:20,drain:.5},
 gigassorbi:{n:'Gigassorbimento',t:'ERB',p:75,a:100,pp:10,drain:.5},
 solarraggio:{n:'Solarraggio',t:'ERB',p:120,a:100,pp:10},
 spora:{n:'Spora',t:'ERB',p:0,a:75,pp:15,fx:{st:'SLP'}},
 tuonoshock:{n:'Tuonoshock',t:'ELE',p:40,a:100,pp:30,fx:{st:'PAR',ch:.1}},
 fulmine:{n:'Fulmine',t:'ELE',p:90,a:100,pp:15,fx:{st:'PAR',ch:.1}},
 tuono:{n:'Tuono',t:'ELE',p:110,a:70,pp:10,fx:{st:'PAR',ch:.3}},
 tuononda:{n:'Tuononda',t:'ELE',p:0,a:90,pp:20,fx:{st:'PAR'}},
 fangata:{n:'Fangata',t:'TER',p:55,a:100,pp:15,fx:{stat:'spe',d:-1,tgt:'foe',ch:.3}},
 zampata:{n:'Zampata',t:'TER',p:60,a:100,pp:20},
 terremoto:{n:'Terremoto',t:'TER',p:100,a:100,pp:10},
 beccata:{n:'Beccata',t:'VOL',p:35,a:100,pp:35},
 alacolpo:{n:'Alacolpo',t:'VOL',p:60,a:100,pp:20},
 aeroassalto:{n:'Aeroassalto',t:'VOL',p:90,a:95,pp:15},
 forbicata:{n:'Forbicata',t:'INS',p:60,a:100,pp:20},
 sanguisuga:{n:'Sanguisuga',t:'INS',p:20,a:100,pp:15,drain:1},
 ragnatela:{n:'Ragnatela',t:'INS',p:0,a:95,pp:40,fx:{stat:'spe',d:-1,tgt:'foe'}},
 sassata:{n:'Sassata',t:'ROC',p:50,a:90,pp:15},
 frana:{n:'Frana',t:'ROC',p:75,a:90,pp:10},
 lingualunga:{n:'Lingualunga',t:'SPE',p:30,a:100,pp:30,fx:{st:'PAR',ch:.2}},
 ombrartiglio:{n:'Ombrartiglio',t:'SPE',p:70,a:100,pp:15,hc:1},
 psicoraggio:{n:'Psicoraggio',t:'PSI',p:65,a:100,pp:20},
 psichico:{n:'Psichico',t:'PSI',p:90,a:100,pp:10,fx:{stat:'def',d:-1,tgt:'foe',ch:.1}},
 ipnosi:{n:'Ipnosi',t:'PSI',p:0,a:60,pp:20,fx:{st:'SLP'}},
 agilita:{n:'Agilità',t:'PSI',p:0,a:0,pp:30,fx:{stat:'spe',d:2,tgt:'self'}},
 colpokarate:{n:'Colpokarate',t:'LOT',p:50,a:100,pp:25,hc:1},
 doppiocalcio:{n:'Doppiocalcio',t:'LOT',p:30,a:100,pp:30,hits:2},
 sfondamento:{n:'Sfondamento',t:'LOT',p:80,a:100,pp:15},
 fielepunta:{n:'Fielepunta',t:'VEL',p:40,a:100,pp:30,fx:{st:'PSN',ch:.3}},
 fangobomba:{n:'Fangobomba',t:'VEL',p:65,a:100,pp:15,fx:{st:'PSN',ch:.3}},
 velenotossina:{n:'Velenotossina',t:'VEL',p:0,a:90,pp:15,fx:{st:'PSN'}},
 polvergelo:{n:'Polvergelo',t:'GHI',p:40,a:100,pp:25,fx:{st:'FRZ',ch:.1}},
 geloraggio:{n:'Geloraggio',t:'GHI',p:90,a:100,pp:15,fx:{st:'FRZ',ch:.1}},
 bora:{n:'Bora',t:'GHI',p:110,a:70,pp:10,fx:{st:'FRZ',ch:.1}},
 dragosoffio:{n:'Dragosoffio',t:'DRA',p:60,a:100,pp:20,fx:{st:'PAR',ch:.3}},
 dragartigli:{n:'Dragartigli',t:'DRA',p:80,a:100,pp:15}
};

// ---------- Specie ----------
// bs=[hp,atk,def,spe], mv=[[liv,mossa]...], ev={lv,to}, cr=tasso cattura, bx=exp base
function S(id,n,t,bs,mv,ev,cr,bx){return {id,n,t,bs,mv,ev,cr,bx};}
const DEX = [
 // Starter Erba
 S(1,'Fogliotto',['ERB'],[45,49,49,45],[[1,'azione'],[1,'ruggito'],[7,'frustata'],[13,'assorbi'],[20,'foglielama'],[27,'fortifica'],[34,'gigassorbi'],[42,'solarraggio']],{lv:16,to:2},45,64),
 S(2,'Ramarbo',['ERB'],[60,62,63,60],[[1,'azione'],[1,'ruggito'],[7,'frustata'],[13,'assorbi'],[22,'foglielama'],[29,'fortifica'],[36,'gigassorbi'],[44,'solarraggio']],{lv:36,to:3},45,142),
 S(3,'Silvantro',['ERB'],[80,82,83,80],[[1,'azione'],[1,'frustata'],[1,'assorbi'],[22,'foglielama'],[30,'fortifica'],[38,'gigassorbi'],[47,'solarraggio'],[52,'iperraggio']],null,45,236),
 // Starter Fuoco
 S(4,'Bracino',['FUO'],[44,52,43,65],[[1,'graffio'],[1,'ruggito'],[7,'braciere'],[13,'rapido'],[20,'turbofuoco'],[27,'affilatoio'],[34,'lanciafiamme'],[43,'fuocobomba']],{lv:16,to:5},45,65),
 S(5,'Vulpyro',['FUO'],[58,64,58,80],[[1,'graffio'],[1,'ruggito'],[7,'braciere'],[13,'rapido'],[22,'turbofuoco'],[29,'affilatoio'],[36,'lanciafiamme'],[45,'fuocobomba']],{lv:36,to:6},45,142),
 S(6,'Ignidrago',['FUO','VOL'],[78,84,78,100],[[1,'graffio'],[1,'braciere'],[1,'alacolpo'],[22,'turbofuoco'],[30,'aeroassalto'],[38,'lanciafiamme'],[47,'fuocobomba'],[52,'iperraggio']],null,45,240),
 // Starter Acqua
 S(7,'Gocciolo',['ACQ'],[44,48,65,43],[[1,'azione'],[1,'ruggito'],[7,'pistolacqua'],[13,'bolla'],[20,'idropulsar'],[27,'fortifica'],[34,'surf'],[43,'idropompa']],{lv:16,to:8},45,63),
 S(8,'Ondino',['ACQ'],[59,63,80,58],[[1,'azione'],[1,'ruggito'],[7,'pistolacqua'],[13,'bolla'],[22,'idropulsar'],[29,'fortifica'],[36,'surf'],[45,'idropompa']],{lv:36,to:9},45,142),
 S(9,'Maremoto',['ACQ','LOT'],[79,88,100,68],[[1,'azione'],[1,'pistolacqua'],[1,'colpokarate'],[22,'idropulsar'],[30,'sfondamento'],[38,'surf'],[47,'idropompa'],[52,'iperraggio']],null,45,239),
 // Roditori
 S(10,'Topetto',['NOR'],[30,56,35,72],[[1,'azione'],[4,'ruggito'],[8,'rapido'],[14,'morso'],[21,'affilatoio'],[27,'bodyslam']],{lv:18,to:11},255,57),
 S(11,'Ratteo',['NOR'],[55,81,60,97],[[1,'azione'],[1,'rapido'],[14,'morso'],[23,'affilatoio'],[30,'bodyslam'],[40,'iperraggio']],null,127,116),
 // Uccelli
 S(12,'Passerino',['NOR','VOL'],[40,45,40,56],[[1,'beccata'],[5,'ruggito'],[9,'rapido'],[15,'alacolpo'],[23,'agilita']],{lv:18,to:13},255,54),
 S(13,'Falchetto',['NOR','VOL'],[63,60,55,71],[[1,'beccata'],[1,'rapido'],[15,'alacolpo'],[25,'agilita'],[32,'aeroassalto']],{lv:34,to:14},120,113),
 S(14,'Aquilone',['NOR','VOL'],[83,80,75,101],[[1,'beccata'],[1,'alacolpo'],[25,'agilita'],[34,'aeroassalto'],[45,'iperraggio']],null,45,172),
 // Insetti
 S(15,'Brucolo',['INS'],[45,30,35,45],[[1,'azione'],[1,'ragnatela']],{lv:7,to:16},255,39),
 S(16,'Bozzolo',['INS'],[50,20,55,30],[[1,'azione'],[1,'fortifica']],{lv:12,to:17},120,72),
 S(17,'Farfalume',['INS','VOL'],[60,45,50,70],[[1,'forbicata'],[12,'ipnosi'],[16,'alacolpo'],[22,'sanguisuga'],[28,'psicoraggio'],[34,'aeroassalto']],null,45,160),
 // Funghi
 S(18,'Funghetto',['ERB','VEL'],[50,55,45,35],[[1,'assorbi'],[6,'fielepunta'],[12,'spora'],[19,'frustata'],[26,'gigassorbi']],{lv:24,to:19},190,65),
 S(19,'Sporafung',['ERB','VEL'],[70,80,70,55],[[1,'assorbi'],[1,'fielepunta'],[12,'spora'],[21,'frustata'],[28,'gigassorbi'],[36,'fangobomba']],null,75,159),
 // Elettro
 S(20,'Scintillo',['ELE'],[35,55,40,90],[[1,'rapido'],[1,'tuonoshock'],[9,'ruggito'],[16,'tuononda'],[24,'fulmine'],[33,'agilita']],{lv:20,to:21},190,58),
 S(21,'Voltappo',['ELE'],[60,75,55,105],[[1,'rapido'],[1,'tuonoshock'],[16,'tuononda'],[26,'fulmine'],[35,'agilita'],[42,'tuono']],{lv:38,to:22},75,120),
 S(22,'Fulminex',['ELE'],[75,95,70,125],[[1,'rapido'],[1,'tuonoshock'],[1,'tuononda'],[26,'fulmine'],[36,'agilita'],[44,'tuono']],null,45,199),
 // Rocce
 S(23,'Sassolo',['ROC','TER'],[40,80,100,20],[[1,'azione'],[6,'fortifica'],[11,'sassata'],[18,'zampata'],[25,'frana'],[34,'terremoto']],{lv:28,to:24},255,73),
 S(24,'Macignor',['ROC','TER'],[70,110,130,35],[[1,'azione'],[1,'sassata'],[18,'zampata'],[27,'frana'],[36,'terremoto'],[44,'iperraggio']],null,90,166),
 // Talpe
 S(25,'Talpino',['TER'],[35,65,45,80],[[1,'graffio'],[5,'ruggito'],[11,'fangata'],[18,'zampata'],[26,'affilatoio'],[33,'terremoto']],{lv:26,to:26},255,66),
 S(26,'Scavatore',['TER'],[60,90,70,110],[[1,'graffio'],[1,'fangata'],[18,'zampata'],[28,'affilatoio'],[36,'terremoto'],[44,'iperraggio']],null,90,153),
 // Delfini
 S(27,'Pinnello',['ACQ'],[45,50,45,60],[[1,'bolla'],[7,'ruggito'],[13,'pistolacqua'],[20,'rapido'],[27,'idropulsar'],[35,'surf']],{lv:25,to:28},210,61),
 S(28,'Delfargo',['ACQ'],[70,80,70,95],[[1,'bolla'],[1,'pistolacqua'],[20,'rapido'],[29,'idropulsar'],[37,'surf'],[45,'idropompa']],null,80,158),
 // Spettri
 S(29,'Ombrino',['SPE'],[30,35,30,80],[[1,'lingualunga'],[8,'ipnosi'],[15,'ombrartiglio'],[23,'velenotossina'],[31,'agilita']],{lv:25,to:30},190,62),
 S(30,'Spettrolo',['SPE'],[45,50,45,95],[[1,'lingualunga'],[1,'ipnosi'],[15,'ombrartiglio'],[25,'velenotossina'],[33,'agilita'],[40,'psichico']],{lv:40,to:31},90,142),
 S(31,'Fantasmor',['SPE','VEL'],[60,65,60,110],[[1,'lingualunga'],[1,'ombrartiglio'],[25,'fangobomba'],[33,'ipnosi'],[41,'psichico'],[48,'iperraggio']],null,45,190),
 // Psico
 S(32,'Mentino',['PSI'],[25,20,15,90],[[1,'azione'],[10,'psicoraggio'],[16,'ipnosi'],[24,'agilita'],[32,'psichico']],{lv:30,to:33},200,75),
 S(33,'Psicardo',['PSI'],[55,45,45,120],[[1,'azione'],[1,'psicoraggio'],[16,'ipnosi'],[26,'agilita'],[34,'psichico'],[44,'ripresa']],null,50,145),
 // Lotta
 S(34,'Pugnetto',['LOT'],[50,80,50,35],[[1,'colpokarate'],[7,'ruggito'],[13,'doppiocalcio'],[20,'affilatoio'],[28,'sfondamento']],{lv:28,to:35},180,75),
 S(35,'Kolosso',['LOT'],[80,120,80,45],[[1,'colpokarate'],[1,'doppiocalcio'],[22,'affilatoio'],[30,'sfondamento'],[40,'bodyslam'],[48,'iperraggio']],null,60,166),
 // Veleno
 S(36,'Tossino',['VEL'],[40,60,50,55],[[1,'fielepunta'],[6,'azione'],[12,'velenotossina'],[19,'morso'],[26,'fangobomba']],{lv:30,to:37},190,62),
 S(37,'Velenax',['VEL'],[65,90,75,80],[[1,'fielepunta'],[1,'morso'],[19,'velenotossina'],[28,'fangobomba'],[38,'zampata'],[46,'iperraggio']],null,75,153),
 // Ghiaccio
 S(38,'Gelino',['GHI'],[50,50,50,55],[[1,'polvergelo'],[8,'ruggito'],[14,'rapido'],[21,'geloraggio'],[30,'agilita']],{lv:32,to:39},190,64),
 S(39,'Cristallux',['GHI'],[75,80,80,85],[[1,'polvergelo'],[1,'rapido'],[21,'geloraggio'],[32,'agilita'],[40,'bora'],[48,'iperraggio']],null,70,158),
 // Orsi
 S(40,'Orsetto',['NOR'],[60,70,45,40],[[1,'graffio'],[7,'ruggito'],[13,'morso'],[20,'affilatoio'],[27,'bodyslam']],{lv:30,to:41},150,68),
 S(41,'Orsone',['NOR'],[90,110,75,55],[[1,'graffio'],[1,'morso'],[22,'affilatoio'],[30,'bodyslam'],[40,'sfondamento'],[48,'iperraggio']],null,60,175),
 // Pipistrelli
 S(42,'Pipistro',['VEL','VOL'],[40,45,35,75],[[1,'beccata'],[6,'fielepunta'],[13,'sanguisuga'],[20,'morso'],[28,'alacolpo']],{lv:28,to:43},255,54),
 S(43,'Notturnix',['VEL','VOL'],[75,80,70,110],[[1,'beccata'],[1,'fielepunta'],[20,'morso'],[30,'alacolpo'],[38,'fangobomba'],[45,'aeroassalto']],null,90,152),
 // Lava
 S(44,'Lavillo',['FUO','ROC'],[55,70,85,30],[[1,'azione'],[8,'braciere'],[15,'sassata'],[22,'turbofuoco'],[30,'fortifica'],[38,'frana']],{lv:30,to:45},120,70),
 S(45,'Magmaro',['FUO','ROC'],[80,100,115,45],[[1,'azione'],[1,'braciere'],[22,'turbofuoco'],[32,'frana'],[40,'lanciafiamme'],[48,'terremoto']],null,60,170),
 // Draghi
 S(46,'Draghetto',['DRA'],[41,64,45,50],[[1,'azione'],[8,'ruggito'],[15,'dragosoffio'],[22,'agilita'],[30,'morso']],{lv:30,to:47},60,60),
 S(47,'Dracone',['DRA'],[61,84,65,70],[[1,'azione'],[1,'dragosoffio'],[24,'agilita'],[32,'morso'],[40,'dragartigli']],{lv:45,to:48},45,147),
 S(48,'Draghemor',['DRA','VOL'],[91,114,95,100],[[1,'dragosoffio'],[1,'alacolpo'],[32,'agilita'],[41,'dragartigli'],[48,'aeroassalto'],[54,'iperraggio']],null,35,255),
 // Singoli
 S(49,'Voltanguil',['ELE','ACQ'],[65,75,70,65],[[1,'tuonoshock'],[10,'bolla'],[18,'tuononda'],[26,'idropulsar'],[34,'fulmine'],[42,'surf']],null,90,145),
 S(50,'Statuo',['ROC','PSI'],[70,60,105,30],[[1,'sassata'],[12,'psicoraggio'],[20,'fortifica'],[28,'ipnosi'],[36,'frana'],[44,'psichico']],null,75,150),
 S(51,'Nebbiolo',['GHI','SPE'],[60,55,60,90],[[1,'polvergelo'],[12,'lingualunga'],[20,'ipnosi'],[28,'geloraggio'],[36,'ombrartiglio'],[44,'bora']],null,60,155),
 S(52,'Leonzio',['NOR'],[85,95,65,90],[[1,'morso'],[15,'ruggito'],[25,'affilatoio'],[35,'bodyslam'],[45,'iperraggio']],null,45,180),
 S(53,'Tritone',['ACQ','ERB'],[75,70,80,60],[[1,'bolla'],[12,'assorbi'],[20,'frustata'],[28,'idropulsar'],[36,'gigassorbi'],[44,'surf']],null,75,155),
 S(54,'Solverio',['PSI','VOL'],[100,110,90,130],[[1,'psicoraggio'],[1,'aeroassalto'],[40,'agilita'],[50,'psichico'],[60,'iperraggio']],null,3,255)
];
const SP = id=>DEX[id-1];

// ---------- Oggetti ----------
const ITEMS = {
 sfera:{n:'Valsfera', ball:1, buy:200, d:'Cattura creature selvatiche.'},
 supersfera:{n:'Supersfera', ball:1.5, buy:600, d:'Sfera migliorata (x1,5).'},
 ultrasfera:{n:'Ultrasfera', ball:2, buy:1200, d:'Sfera avanzata (x2).'},
 pozione:{n:'Pozione', heal:20, buy:300, d:'Cura 20 PS.'},
 superpozione:{n:'Superpozione', heal:60, buy:700, d:'Cura 60 PS.'},
 pozionemax:{n:'Pozione Max', heal:9999, buy:2500, d:'Cura tutti i PS.'},
 antidoto:{n:'Antidoto', cure:'PSN', buy:100, d:'Cura il veleno.'},
 paralisan:{n:'Paralisan', cure:'PAR', buy:200, d:'Cura la paralisi.'},
 risveglio:{n:'Risveglio', cure:'SLP', buy:250, d:'Cura il sonno.'},
 antigelo:{n:'Antigelo', cure:'FRZ', buy:250, d:'Cura il congelamento.'},
 antiscottatura:{n:'Antiscottatura', cure:'BRN', buy:250, d:'Cura la scottatura.'},
 curatotale:{n:'Curatotale', cure:'ALL', buy:600, d:'Cura ogni stato alterato.'},
 revitalizzante:{n:'Revitalizzante', revive:.5, buy:1500, d:'Rianima una creatura KO.'}
};

// ================================================================
// PARTE 2 — Regione di Valmora: città, percorsi, allenatori
// ================================================================
const WORLD_W=256, WORLD_H=256, TILE=16;
// tile: 0 erba,1 erba alta,2 albero,3 sentiero,4 fiori,5 acqua,6 staccionata,7 cartello,
// 8 porta,9 muro,11 finestra,12 tappeto uscita,13 pavimento,14 tappeto,15 bancone,16 macchina cure,
// 17 PC,18 libreria,19 statua,30-34 tetti (centro,market,palestra,casa,lab/lega), 20 altare
const SOLID = new Set([2,5,6,7,9,11,15,16,17,18,19,30,31,32,33,34,20]);

const TOWNS = [
 {n:'Borgofoglia', x:28, y:210, lab:true, motto:'Dove ogni viaggio comincia.'},
 {n:'Pietraforte', x:28, y:158, gym:{type:'ROC', leader:'Rocco', badge:'Medaglia Macigno', party:[[23,10],[23,12],[24,14]], money:1400, intro:'Sono Rocco! La mia difesa è dura come il granito!', lose:'Incredibile... sei riuscito a spezzare la roccia!'}, motto:'La città dal cuore di pietra.'},
 {n:'Ondaporto', x:86, y:158, gym:{type:'ACQ', leader:'Marina', badge:'Medaglia Cascata', party:[[27,16],[27,17],[28,19]], money:1900, intro:'Benvenuto! Le mie onde ti travolgeranno!', lose:'La marea si ritira... hai vinto!'}, motto:'Il porto delle grandi onde.'},
 {n:'Voltacittà', x:86, y:96, gym:{type:'ELE', leader:'Elettra', badge:'Medaglia Scintilla', party:[[20,20],[49,21],[21,24]], money:2400, intro:'Zzzap! Preparati alla scossa!', lose:'Corto circuito... complimenti!'}, motto:'La città che non dorme mai.'},
 {n:'Boscoverde', x:150, y:96, gym:{type:'ERB', leader:'Silvia', badge:'Medaglia Fronda', party:[[18,24],[53,26],[19,29]], money:2900, intro:'La natura è dalla mia parte!', lose:'Anche i boschi si inchinano a te.'}, motto:'Immersa nel verde antico.'},
 {n:'Tossinia', x:150, y:158, gym:{type:'VEL', leader:'Vespera', badge:'Medaglia Tossina', party:[[36,28],[42,29],[37,32]], money:3400, intro:'Il mio veleno ti consumerà lentamente...', lose:'Hai un antidoto per tutto, eh?'}, motto:'Attenti a dove mettete i piedi.'},
 {n:'Mentevilla', x:214, y:158, gym:{type:'PSI', leader:'Sibilla', badge:'Medaglia Mente', party:[[32,32],[50,33],[33,36]], money:3900, intro:'Avevo previsto il tuo arrivo...', lose:'Questo... non l\'avevo previsto.'}, motto:'La città dei pensieri profondi.'},
 {n:'Nevalta', x:214, y:84, gym:{type:'GHI', leader:'Boreas', badge:'Medaglia Gelo', party:[[38,36],[51,38],[39,40]], money:4400, intro:'Il freddo congela ogni speranza!', lose:'Il ghiaccio si è sciolto davanti a te.'}, motto:'Tra le vette innevate.'},
 {n:'Dragospoli', x:150, y:40, gym:{type:'DRA', leader:'Drakon', badge:'Medaglia Zanna', party:[[46,40],[47,42],[48,45]], money:5000, intro:'I draghi non conoscono la sconfitta!', lose:'Sei degno della Lega. Vai, campione!'}, motto:'L\'antica dimora dei draghi.'},
 {n:'Lega Valmora', x:86, y:40, league:true, motto:'Solo i migliori giungono qui.'}
];
// percorsi: coppie di città consecutive
const ROUTE_LINKS = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]];
const ROUTE_POOLS = [
 {lv:[2,4],  pool:[[10,30],[12,30],[15,25],[16,15]]},
 {lv:[5,8],  pool:[[10,25],[12,20],[15,15],[18,20],[23,20]]},
 {lv:[10,14],pool:[[27,25],[10,20],[42,25],[20,20],[49,5],[16,5]]},
 {lv:[14,18],pool:[[20,20],[18,20],[25,25],[12,20],[50,5],[10,10]]},
 {lv:[18,22],pool:[[18,20],[36,25],[17,15],[42,20],[53,8],[34,12]]},
 {lv:[22,26],pool:[[36,20],[32,20],[29,25],[42,15],[11,10],[40,10]]},
 {lv:[26,30],pool:[[38,25],[29,20],[40,20],[51,8],[13,15],[52,4],[34,8]]},
 {lv:[30,34],pool:[[38,20],[44,25],[46,15],[40,15],[43,15],[39,5],[24,5]]},
 {lv:[34,40],pool:[[46,20],[44,15],[23,15],[52,10],[51,10],[43,15],[47,5],[30,10]]}
];
const ROUTE_TRAINERS = [
 [{f:.5, name:'Bimbo Ugo', cls:'bimbo', party:[[10,3],[12,3]], t:'Ehi! Facciamo una lotta!', l:'Uffa, ho perso!'}],
 [{f:.35, name:'Bulletto Leo', cls:'bullo', party:[[10,6],[15,6]], t:'Fermo lì! Le tue creature o una lotta!', l:'Va bene, va bene, passa pure...'},
  {f:.7, name:'Bimba Mia', cls:'bimba', party:[[12,7]], t:'Il mio uccellino è fortissimo!', l:'Piip... è stanchino.'}],
 [{f:.3, name:'Pescatore Gino', cls:'pesca', party:[[27,11],[27,12]], t:'I miei delfini sono campioni!', l:'Splash... che disfatta.'},
  {f:.65, name:'Scout Ivo', cls:'scout', party:[[20,12],[10,13]], t:'Sempre pronti! Anche a lottare!', l:'Non ero pronto a questo...'}],
 [{f:.3, name:'Escursionista Tom', cls:'monta', party:[[23,15],[25,16]], t:'Le mie rocce vengono dalla montagna!', l:'Sei più tosto di un macigno.'},
  {f:.7, name:'Studiosa Ada', cls:'studio', party:[[32,16],[20,17]], t:'Ho studiato ogni strategia possibile!', l:'Devo tornare sui libri.'}],
 [{f:.3, name:'Retina Bea', cls:'retina', party:[[15,18],[17,20],[18,20]], t:'I miei insetti sono adorabili e letali!', l:'Nooo, i miei tesorini!'},
  {f:.7, name:'Teppista Rino', cls:'bullo', party:[[36,21],[42,21]], t:'Questa strada è mia!', l:'Ok ok, la strada è tua.'}],
 [{f:.3, name:'Medium Elsa', cls:'medium', party:[[29,24],[32,24]], t:'Gli spiriti mi sussurrano la vittoria...', l:'Gli spiriti si erano sbagliati.'},
  {f:.7, name:'Teppista Caio', cls:'bullo', party:[[36,25],[11,25]], t:'Ehi tu! Paga il pedaggio... in lotta!', l:'Pedaggio annullato...'}],
 [{f:.3, name:'Sciatore Ugo', cls:'scia', party:[[38,28],[38,29]], t:'Qui l\'aria è gelida come le mie mosse!', l:'Brrr... che batosta.'},
  {f:.7, name:'Montanaro Gigi', cls:'monta', party:[[40,29],[23,28]], t:'Vivo su queste vette da trent\'anni!', l:'Roccia frantumata!'}],
 [{f:.3, name:'Domatore Ras', cls:'doma', party:[[46,32],[44,32]], t:'Domo draghi da una vita!', l:'Nemmeno i draghi ti fermano...'},
  {f:.7, name:'Esperta Nina', cls:'studio', party:[[39,33],[35,33]], t:'Pochi arrivano fin quassù!', l:'Meriti la vetta.'}],
 [{f:.35, name:'Asso Marco', cls:'asso', party:[[13,36],[21,36],[45,37]], t:'Solo i migliori percorrono la Via della Lega!', l:'Sei pronto per la Lega.'},
  {f:.7, name:'Asso Lia', cls:'asso', party:[[28,37],[43,37],[47,38]], t:'Ultimo ostacolo prima della Lega: io!', l:'La Lega ti attende, campione.'}]
];
const GYM_TRAINERS = [
 null,
 {name:'Alpinista Berto', cls:'monta', party:[[23,9],[23,9]], t:'Prima del capopalestra, superami!', l:'Rocco ti aspetta...'},
 {name:'Nuotatrice Sara', cls:'nuoto', party:[[27,14],[27,15]], t:'L\'acqua è il mio elemento!', l:'Glub glub...'},
 {name:'Tecnico Aldo', cls:'studio', party:[[20,18],[20,19]], t:'Alta tensione in arrivo!', l:'Sistema in tilt.'},
 {name:'Giardiniere Ivo', cls:'retina', party:[[18,22],[53,22]], t:'Il giardino della palestra è sacro!', l:'Le mie piantine...'},
 {name:'Chimico Otto', cls:'studio', party:[[36,26],[42,26]], t:'Attento alle esalazioni!', l:'Esperimento fallito.'},
 {name:'Veggente Lara', cls:'medium', party:[[32,30],[29,30]], t:'Leggo il tuo futuro: sconfitta!', l:'Le carte mentivano...'},
 {name:'Alpinista Elke', cls:'scia', party:[[38,34],[40,34]], t:'Il gelo non perdona!', l:'Mi sono congelata da sola.'},
 {name:'Domatrice Zea', cls:'doma', party:[[46,38],[44,38]], t:'I cuccioli di drago mordono!', l:'Tornate nel nido, piccoli...'},
 null
];
const ELITE = [
 {name:'Aldo dei Quattro', cls:'elite', party:[[34,45],[35,47],[35,48]], money:4500, t:'Io sono Aldo, maestro di Lotta! Mostrami la tua forza!', l:'Che potenza... vai oltre!'},
 {name:'Bruna dei Quattro', cls:'elite', party:[[29,46],[30,48],[31,49]], money:4500, t:'Io sono Bruna. I miei spettri ti gelano il sangue...', l:'Anche le ombre si inchinano.'},
 {name:'Glacia dei Quattro', cls:'elite', party:[[38,46],[51,48],[39,50]], money:4500, t:'Io sono Glacia. Benvenuto nel mio inverno eterno!', l:'Il disgelo è arrivato...'},
 {name:'Ercole dei Quattro', cls:'elite', party:[[46,47],[47,49],[48,51]], money:4500, t:'Io sono Ercole, l\'ultimo bastione! I draghi sono con me!', l:'Ruggito domato... la Campionessa ti attende!'}
];
const CHAMPION = {name:'Campionessa Vittoria', cls:'campione', party:[[14,50],[22,51],[45,51],[53,52],[48,54]], money:10000,
 t:'Benvenuto, sfidante. Sono Vittoria, Campionessa di Valmora. Dammi tutto ciò che hai!',
 l:'...Straordinario. Da oggi, il titolo di Campione di Valmora è tuo!'};

// ---------- Costruzione del mondo ----------
const MAPS = {};
let ZONE; // zona percorso per incontri
function T(map,x,y,v){ if(x>=0&&y>=0&&x<map.w&&y<map.h) map.t[y*map.w+x]=v; }
function G(map,x,y){ return (x<0||y<0||x>=map.w||y>=map.h)?2:map.t[y*map.w+x]; }
function newMap(id,w,h,fill){ const m={id,w,h,t:new Uint8Array(w*h).fill(fill),warps:{},npcs:[],signs:{}}; MAPS[id]=m; return m; }

function carveRoute(m, rng, ax,ay,bx,by, ridx){
 // percorso a L: verticale poi orizzontale (o viceversa)
 const pts=[];
 const vert1 = Math.abs(by-ay)>=Math.abs(bx-ax);
 const cx = vert1?ax:bx, cy = vert1?by:ay;
 const line=(x0,y0,x1,y1)=>{ const dx=Math.sign(x1-x0),dy=Math.sign(y1-y0); let x=x0,y=y0; pts.push([x,y]); while(x!==x1||y!==y1){ if(x!==x1)x+=dx; else y+=dy; pts.push([x,y]); } };
 line(ax,ay,cx,cy); line(cx,cy,bx,by);
 for(const [px,py] of pts){
  for(let ox=-2;ox<=2;ox++)for(let oy=-2;oy<=2;oy++){
   const x=px+ox,y=py+oy;
   if(x<1||y<1||x>=WORLD_W-1||y>=WORLD_H-1)continue;
   const edge=Math.abs(ox)===2||Math.abs(oy)===2;
   const cur=G(m,x,y);
   if(cur===2||cur===0||cur===1){
    T(m,x,y, edge? (rng()<.5?0:2) : 0);
    if(!edge) ZONE[y*WORLD_W+x]=ridx+1;
   }
  }
  T(m,px,py,3); // sentiero centrale
 }
 // ciuffi d'erba alta
 for(let i=0;i<pts.length;i+=6){
  if(rng()<.75){
   const [px,py]=pts[Math.min(i+Math.floor(rng()*5),pts.length-1)];
   for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
    const x=px+ox,y=py+oy;
    if(G(m,x,y)===0&&rng()<.8){ T(m,x,y,1); ZONE[y*WORLD_W+x]=ridx+1; }
   }
  }
 }
 return pts;
}
function placeBuilding(m,bx,by,w,h,roof,warpTo){
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const gy=by+y,gx=bx+x;
  if(y<h-2) T(m,gx,gy,roof);
  else if(y===h-2) T(m,gx,gy,(x%2===1)?11:9);
  else T(m,gx,gy,9);
 }
 const dx=bx+(w>>1), dy=by+h-1;
 T(m,dx,dy,8);
 if(warpTo) m.warps[dx+','+dy]=warpTo;
 return [dx,dy];
}
function stdInterior(id,w,h){
 const m=newMap(id,w,h,13);
 for(let x=0;x<w;x++)T(m,x,0,9);
 for(let y=0;y<h;y++){T(m,0,y,9);T(m,w-1,y,9);}
 for(let x=0;x<w;x++)T(m,x,h-1,9);
 return m;
}
function buildWorld(){
 const rng = mulberry32(20260717);
 ZONE = new Uint8Array(WORLD_W*WORLD_H);
 const w = newMap('world', WORLD_W, WORLD_H, 2);
 // laghetti decorativi
 for(let i=0;i<25;i++){ const lx=ri(10,WORLD_W-14), ly=ri(10,WORLD_H-14);
  for(let y=0;y<ri(3,5);y++)for(let x=0;x<ri(4,7);x++) T(w,lx+x,ly+y,5); }
 // percorsi
 const routePts=[];
 for(let r=0;r<ROUTE_LINKS.length;r++){
  const [a,b]=ROUTE_LINKS[r];
  routePts[r]=carveRoute(w,rng,TOWNS[a].x,TOWNS[a].y,TOWNS[b].x,TOWNS[b].y,r);
 }
 // città
 for(let ti=0;ti<TOWNS.length;ti++){
  const tw=TOWNS[ti], cx=tw.x, cy=tw.y;
  for(let y=cy-9;y<=cy+11;y++)for(let x=cx-13;x<=cx+13;x++){
   if(x<1||y<1||x>=WORLD_W-1||y>=WORLD_H-1)continue;
   T(w,x,y,0); ZONE[y*WORLD_W+x]=0;
  }
  for(let x=cx-13;x<=cx+13;x++) T(w,x,cy+1,3);
  for(let y=cy-9;y<=cy+11;y++) T(w,cx,y,3);
  // fiori
  for(let i=0;i<10;i++){ const fx=cx+ri(-12,12), fy=cy+ri(-8,10); if(G(w,fx,fy)===0)T(w,fx,fy,4); }
  // Centro e Market (tutte le città tranne la Lega)
  if(!tw.league){
   placeBuilding(w,cx-9,cy-6,5,4,30,{map:'center'+ti,x:4,y:5});
   placeBuilding(w,cx+5,cy-6,5,4,31,{map:'market'+ti,x:4,y:5});
  }
  if(tw.gym) placeBuilding(w,cx-3,cy+4,7,5,32,{map:'gym'+ti,x:5,y:11});
  if(tw.lab) placeBuilding(w,cx-3,cy+4,7,5,34,{map:'lab',x:5,y:7});
  if(tw.league) placeBuilding(w,cx-4,cy-7,9,6,34,{map:'league',x:6,y:26});
  // case
  if(!tw.league){
   placeBuilding(w,cx-11,cy+5,4,4,33,{map:'house'+ti,x:3,y:4});
  }
  // cartello
  T(w,cx-2,cy+2,7);
  w.signs[(cx-2)+','+(cy+2)] = tw.n.toUpperCase()+' — '+tw.motto;
  // NPC cittadino
  w.npcs.push({x:cx+3,y:cy+3,dir:2,spr:ti%5,text:townChat(ti)});
 }
 // allenatori sui percorsi
 for(let r=0;r<ROUTE_TRAINERS.length;r++){
  for(const tr of ROUTE_TRAINERS[r]){
   const pts=routePts[r]; const p=pts[Math.floor(tr.f*pts.length)];
   const id='rt'+r+'_'+tr.name.replace(/\W/g,'');
   w.npcs.push({x:p[0],y:p[1],dir:2,spr:'T',cls:tr.cls,trainer:{id,name:tr.name,party:tr.party,money:tr.party[tr.party.length-1][1]*40,t:tr.t,l:tr.l}});
  }
 }
 // guardia della Lega sul percorso finale
 {
  const pts=routePts[8]; const p=pts[Math.floor(.12*pts.length)];
  for(let ox=-2;ox<=2;ox++)for(let oy=-2;oy<=2;oy++){ if(ox===0&&oy===0)continue; const x=p[0]+ox,y=p[1]+oy; if(ZONE[y*WORLD_W+x]===9||G(w,x,y)===3||G(w,x,y)===0||G(w,x,y)===1){ if(Math.abs(ox)<=1&&Math.abs(oy)<=1)T(w,x,y,6); } }
  T(w,p[0],p[1],3);
  w.npcs.push({x:p[0],y:p[1],dir:2,spr:4,guard:true,text:'Questa è la Via della Lega! Possono passare solo gli allenatori con tutte le 8 medaglie di Valmora.'});
 }
 // altare di Solverio vicino alla Lega
 { const ax=TOWNS[9].x+8, ay=TOWNS[9].y+8; T(w,ax,ay,20); w.signs[ax+','+ay]='ALTARE'; }
 buildInteriors();
}
function townChat(ti){
 const c=[
  'Benvenuto a Borgofoglia! Il Prof. Cedro cerca giovani allenatori: il suo laboratorio è qui a sud!',
  'Rocco, il capopalestra, usa creature di tipo Roccia. L\'Erba e l\'Acqua le sgretolano!',
  'Marina adora il tipo Acqua. Un bel tipo Erba o Elettro e la palestra è tua!',
  'Elettra è velocissima! Il tipo Terra è immune alle sue scosse.',
  'Silvia coltiva creature Erba. Fuoco, Ghiaccio e Volante fanno faville qui!',
  'Vespera avvelena chiunque. Porta tanti antidoti, e magari un tipo Psico o Terra!',
  'Sibilla legge nel pensiero... i tipi Insetto e Spettro la mettono in crisi!',
  'Boreas congela tutto. Fuoco, Roccia e Lotta rompono il ghiaccio!',
  'Drakon è il più forte capopalestra. Solo Ghiaccio e Drago scalfiscono i suoi draghi!',
  'La Lega di Valmora: i Quattro dell\'Élite e la Campionessa ti attendono. Puoi curarti al centro prima di entrare... ah no, qui non c\'è! Preparati bene!'
 ]; return c[ti]||'Bella giornata, vero?';
}
function buildInteriors(){
 for(let ti=0;ti<TOWNS.length;ti++){
  const tw=TOWNS[ti];
  if(!tw.league){
   // Centro cure
   const c=stdInterior('center'+ti,9,7);
   for(let x=2;x<7;x++)T(c,x,2,15);
   T(c,7,2,16); T(c,1,2,17);
   T(c,4,6,12); c.warps['4,6']={map:'world',x:TOWNS[ti].x-9+2,y:TOWNS[ti].y-6+4};
   c.npcs.push({x:4,y:1,dir:2,spr:'N',nurse:true,text:''});
   // Market
   const mk=stdInterior('market'+ti,9,7);
   for(let y=2;y<5;y++)T(mk,2,y,15);
   T(mk,6,2,18);T(mk,7,2,18);
   T(mk,4,6,12); mk.warps['4,6']={map:'world',x:TOWNS[ti].x+5+2,y:TOWNS[ti].y-6+4};
   mk.npcs.push({x:1,y:3,dir:1,spr:'M',shop:ti,text:''});
   // Casa
   const h=stdInterior('house'+ti,7,6);
   T(h,5,2,18);T(h,1,2,14);
   T(h,3,5,12); h.warps['3,5']={map:'world',x:TOWNS[ti].x-11+2,y:TOWNS[ti].y+5+4};
   h.npcs.push({x:2,y:3,dir:2,spr:(ti+2)%5,text:houseChat(ti)});
  }
  if(tw.gym){
   const g=stdInterior('gym'+ti,11,13);
   T(g,2,3,19);T(g,8,3,19);T(g,2,8,19);T(g,8,8,19);
   for(let y=4;y<11;y++)T(g,5,y,14);
   T(g,5,12,12); g.warps['5,12']={map:'world',x:TOWNS[ti].x-3+3,y:TOWNS[ti].y+4+5};
   const gt=GYM_TRAINERS[ti];
   if(gt) g.npcs.push({x:5,y:8,dir:2,spr:'T',cls:gt.cls,trainer:{id:'gymt'+ti,name:gt.name,party:gt.party,money:gt.party[0][1]*40,t:gt.t,l:gt.l}});
   g.npcs.push({x:5,y:2,dir:2,spr:'L',cls:'leader',trainer:{id:'leader'+ti,name:tw.gym.leader,party:tw.gym.party,money:tw.gym.money,t:tw.gym.intro,l:tw.gym.lose,badge:ti,badgeName:tw.gym.badge}});
  }
  if(tw.lab){
   const l=stdInterior('lab',11,9);
   for(let x=3;x<8;x++)T(l,x,3,15);
   T(l,1,2,18);T(l,2,2,18);T(l,8,2,18);T(l,9,2,18);
   T(l,5,8,12); l.warps['5,8']={map:'world',x:TOWNS[0].x-3+3,y:TOWNS[0].y+4+5};
   l.npcs.push({x:5,y:2,dir:2,spr:'P',prof:true,text:''});
  }
  if(tw.league){
   const lg=stdInterior('league',13,28);
   for(let x=0;x<13;x++)T(lg,x,1,9);
   for(let y=2;y<27;y++){T(lg,4,y,9);T(lg,8,y,9);} // corridoio centrale
   for(let y=2;y<27;y++){T(lg,5,y,13);T(lg,6,y,14);T(lg,7,y,13);}
   T(lg,6,27,12); lg.warps['6,27']={map:'world',x:TOWNS[9].x-4+4,y:TOWNS[9].y-7+6};
   const ys=[22,17,12,7];
   for(const yy of [...ys,3]){ T(lg,5,yy,19); T(lg,7,yy,19); } // strettoie: si passa solo al centro
   for(let e=0;e<4;e++){
    lg.npcs.push({x:6,y:ys[e],dir:2,spr:'E',cls:'elite',blockUntilBeat:true,trainer:{id:'elite'+e,name:ELITE[e].name,party:ELITE[e].party,money:ELITE[e].money,t:ELITE[e].t,l:ELITE[e].l,elite:e}});
   }
   lg.npcs.push({x:6,y:3,dir:2,spr:'C',cls:'campione',blockUntilBeat:true,trainer:{id:'champion',name:CHAMPION.name,party:CHAMPION.party,money:CHAMPION.money,t:CHAMPION.t,l:CHAMPION.l,champion:true}});
  }
 }
}
function houseChat(ti){
 const c=[
  'Le creature nell\'erba alta saltano fuori all\'improvviso! Compra qualche Valsfera al market.',
  'Dicono che una creatura leggendaria dorma su un altare vicino alla Lega...',
  'Se una creatura impara troppe mosse, dovrai fargliene dimenticare una. Scegli con saggezza!',
  'Le creature si evolvono salendo di livello. Alcune cambiano persino tipo!',
  'Il veleno fa male anche fuori dalla lotta? No, qui a Valmora no. Che sollievo!',
  'Gli stati alterati sono terribili: il sonno ti blocca, il gelo pure... porta le cure giuste!',
  'Mia nonna diceva: allena creature di tipi diversi e nessuna palestra ti fermerà.',
  'Da qui si vede Dragospoli. Lassù l\'aria sa di leggenda.',
  'La Via della Lega è dura: allenati almeno al livello 40!',
  ''
 ]; return c[ti]||'Che bella casetta, vero?';
}
// negozio: scorte in base alle medaglie
function shopStock(badges){
 const s=['sfera','pozione','antidoto','paralisan'];
 if(badges>=1)s.push('risveglio');
 if(badges>=2)s.push('superpozione','antigelo','antiscottatura');
 if(badges>=3)s.push('supersfera');
 if(badges>=4)s.push('curatotale');
 if(badges>=5)s.push('revitalizzante');
 if(badges>=6)s.push('ultrasfera','pozionemax');
 return s;
}
// ================================================================
// PARTE 3 — Grafica: tile, sprite creature, personaggi
// ================================================================
const VW=480, VH=320, TD=32; // risoluzione interna, tile a schermo
let cv, ctx;
const tileCache = {};
function mkCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function px(c,x,y,col){ c.fillStyle=col; c.fillRect(x,y,1,1); }

function renderTile(id){
 if(tileCache[id]) return tileCache[id];
 const c=mkCanvas(16,16), g=c.getContext('2d');
 const rng=mulberry32(id*7919+3);
 const fill=(col)=>{g.fillStyle=col;g.fillRect(0,0,16,16);};
 const noise=(col,n)=>{g.fillStyle=col;for(let i=0;i<n;i++)g.fillRect(Math.floor(rng()*16),Math.floor(rng()*16),1,1);};
 switch(id){
  case 0: fill('#7ec850'); noise('#8fd860',40); noise('#6cb845',30); break;
  case 1: fill('#7ec850'); g.fillStyle='#3e8e2e';
    for(let i=0;i<5;i++){const bx=1+i*3;g.fillRect(bx,6,2,9);g.fillRect(bx-1,4,1,4);g.fillRect(bx+2,5,1,5);}
    g.fillStyle='#57a83c'; for(let i=0;i<5;i++){g.fillRect(2+i*3,8,1,7);} break;
  case 2: fill('#7ec850'); g.fillStyle='#5a3d1e'; g.fillRect(6,10,4,6);
    g.fillStyle='#2e7d32'; g.beginPath(); g.arc(8,7,7,0,7); g.fill();
    g.fillStyle='#1b5e20'; g.fillRect(2,8,12,3); g.fillStyle='#43a047';
    g.fillRect(4,2,3,3); g.fillRect(9,3,4,2); break;
  case 3: fill('#d8c088'); noise('#c8b078',30); noise('#e8d098',20); break;
  case 4: fill('#7ec850'); noise('#8fd860',30);
    g.fillStyle='#e84a5f'; g.fillRect(3,3,2,2); g.fillRect(10,9,2,2);
    g.fillStyle='#fff'; g.fillRect(4,10,2,2); g.fillRect(11,4,2,2);
    g.fillStyle='#f8d030'; g.fillRect(4,4,1,1); g.fillRect(11,10,1,1); break;
  case 5: fill('#4a90d8'); noise('#5aa0e8',25); noise('#3a80c8',25);
    g.fillStyle='#8ec8f8'; g.fillRect(2,3,5,1); g.fillRect(9,10,5,1); break;
  case 6: fill('#7ec850'); g.fillStyle='#b08850';
    g.fillRect(1,6,14,3); g.fillRect(2,4,2,9); g.fillRect(12,4,2,9);
    g.fillStyle='#906830'; g.fillRect(1,8,14,1); break;
  case 7: fill('#7ec850'); g.fillStyle='#8a6a3a'; g.fillRect(7,8,2,7);
    g.fillStyle='#c8a868'; g.fillRect(2,2,12,7); g.fillStyle='#8a6a3a';
    g.fillRect(3,3,10,5); g.fillStyle='#e8d8b8'; g.fillRect(4,4,8,1); g.fillRect(4,6,6,1); break;
  case 8: fill('#7a5a3a'); g.fillStyle='#5a3a1a'; g.fillRect(2,1,12,15);
    g.fillStyle='#3a2a12'; g.fillRect(4,3,8,12); g.fillStyle='#c8a868'; g.fillRect(10,8,2,2); break;
  case 9: fill('#d8d0c0'); g.fillStyle='#b8b0a0';
    for(let y=0;y<16;y+=4){g.fillRect(0,y,16,1); for(let x=(y%8?0:2);x<16;x+=6)g.fillRect(x,y,1,4);} break;
  case 11: fill('#d8d0c0'); g.fillStyle='#4a6a9a'; g.fillRect(2,3,12,10);
    g.fillStyle='#8ab8e8'; g.fillRect(3,4,4,4); g.fillRect(9,4,4,4); g.fillRect(3,9,10,3); break;
  case 12: fill('#b03030'); g.fillStyle='#d05050'; g.fillRect(2,2,12,12);
    g.fillStyle='#f0a0a0'; g.fillRect(4,4,8,8); break;
  case 13: fill('#e8d8b0'); noise('#d8c8a0',20); g.fillStyle='#c8b890';
    g.fillRect(0,7,16,1); g.fillRect(7,0,1,16); break;
  case 14: fill('#4a8a4a'); g.fillStyle='#5a9a5a'; g.fillRect(1,1,14,14);
    g.fillStyle='#6aaa6a'; g.fillRect(3,3,10,10); break;
  case 15: fill('#a87848'); g.fillStyle='#c89868'; g.fillRect(0,0,16,6);
    g.fillStyle='#886030'; g.fillRect(0,6,16,2); break;
  case 16: fill('#e8d8b0'); g.fillStyle='#d05050'; g.fillRect(2,4,12,10);
    g.fillStyle='#f8f8f8'; g.fillRect(4,6,8,4); g.fillStyle='#50d0f0'; g.fillRect(5,7,2,2); g.fillRect(9,7,2,2); break;
  case 17: fill('#e8d8b0'); g.fillStyle='#787878'; g.fillRect(2,3,12,11);
    g.fillStyle='#a8e8a8'; g.fillRect(4,5,8,5); g.fillStyle='#585858'; g.fillRect(5,11,6,2); break;
  case 18: fill('#e8d8b0'); g.fillStyle='#8a5a2a'; g.fillRect(1,1,14,14);
    g.fillStyle='#6a3a12'; g.fillRect(2,2,12,5); g.fillRect(2,8,12,5);
    g.fillStyle='#d04040'; g.fillRect(3,3,2,3); g.fillStyle='#4040d0'; g.fillRect(6,3,2,3);
    g.fillStyle='#40a040'; g.fillRect(9,3,2,3); g.fillStyle='#d0a040'; g.fillRect(3,9,2,3); g.fillRect(8,9,2,3); break;
  case 19: fill('#e8d8b0'); g.fillStyle='#a8a8a8'; g.fillRect(4,2,8,10);
    g.fillStyle='#888888'; g.fillRect(3,12,10,3); g.fillStyle='#c8c8c8'; g.fillRect(5,3,3,4); break;
  case 20: fill('#7ec850'); g.fillStyle='#d8d8e8'; g.fillRect(2,6,12,9);
    g.fillStyle='#b8b8d0'; g.fillRect(4,2,8,5); g.fillStyle='#f8f080'; g.fillRect(6,3,4,3); break;
  case 30: fill('#e05048'); g.fillStyle='#c04038'; for(let y=1;y<16;y+=3)g.fillRect(0,y,16,1); break;
  case 31: fill('#4878d0'); g.fillStyle='#3860b8'; for(let y=1;y<16;y+=3)g.fillRect(0,y,16,1); break;
  case 32: fill('#c8a030'); g.fillStyle='#a88020'; for(let y=1;y<16;y+=3)g.fillRect(0,y,16,1); break;
  case 33: fill('#909890'); g.fillStyle='#788078'; for(let y=1;y<16;y+=3)g.fillRect(0,y,16,1); break;
  case 34: fill('#9060c0'); g.fillStyle='#7848a8'; for(let y=1;y<16;y+=3)g.fillRect(0,y,16,1); break;
  default: fill('#000');
 }
 tileCache[id]=c; return c;
}

// sprite creatura procedurale (specchiato, in stile pixel-monster)
const monCache={};
function monSprite(id, back){
 const key=id+(back?'b':'f');
 if(monCache[key])return monCache[key];
 const sp=SP(id), rng=mulberry32(id*104729+7);
 const W=12,H=12, grid=[];
 for(let y=0;y<H;y++){grid[y]=[];for(let x=0;x<W/2;x++){
  const cy=Math.abs(y-6)/6, cx=x/6;
  const p = .75 - cy*.45 - (1-cx)*.28;
  grid[y][x] = rng() < p ? (rng()<.72?1:2) : 0;
 }}
 // corpo connesso: riempi centro
 for(let y=3;y<10;y++)grid[y][4]=grid[y][4]||1;
 for(let y=4;y<9;y++)grid[y][5]=grid[y][5]||1;
 // occhio
 grid[4][3]=3;
 const c1=TYPES[sp.t[0]].c, c2=sp.t[1]?TYPES[sp.t[1]].c:shade(c1,-30);
 const c=mkCanvas(W*4,H*4), g=c.getContext('2d');
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const gx=x<W/2?x:W-1-x, v=grid[y][gx];
  if(!v)continue;
  let col = v===1?c1: v===2?c2 : '#ffffff';
  // ombreggiatura in basso
  if(v!==3 && y>7) col=shade(col,-25);
  if(v!==3 && y<3) col=shade(col,20);
  g.fillStyle=col; g.fillRect(x*4,y*4,4,4);
  if(v===3){ g.fillStyle='#fff'; g.fillRect(x*4,y*4,4,4); g.fillStyle='#111'; g.fillRect(x*4+(x<W/2?2:0),y*4+1,2,2); }
 }
 // contorno
 g.globalCompositeOperation='source-over';
 monCache[key]=c; return c;
}
function shade(hex,amt){
 const n=parseInt(hex.slice(1),16);
 let r=(n>>16)+amt,gg=((n>>8)&255)+amt,b=(n&255)+amt;
 r=Math.max(0,Math.min(255,r));gg=Math.max(0,Math.min(255,gg));b=Math.max(0,Math.min(255,b));
 return '#'+((r<<16)|(gg<<8)|b).toString(16).padStart(6,'0');
}

// ---------- sprite dettagliati (PokeAPI) con fallback procedurale ----------
// mappa specie di Valmora -> sprite del Pokédex nazionale (PokeAPI/sprites su GitHub)
const SPRITE_IDS={
 1:252,2:253,3:254,       // linea Fogliotto  -> Treecko
 4:4,5:5,6:6,             // linea Bracino    -> Charmander
 7:60,8:61,9:62,          // linea Gocciolo   -> Poliwag (finale Acqua/Lotta)
 10:263,11:264,           // Topetto  -> Zigzagoon
 12:276,13:277,14:18,     // Passerino-> Taillow, finale Pidgeot
 15:265,16:266,17:267,    // Brucolo  -> Wurmple/Silcoon/Beautifly
 18:43,19:45,             // Funghetto-> Oddish (Erba/Veleno)
 20:172,21:25,22:26,      // Scintillo-> Pichu/Pikachu/Raichu
 23:74,24:76,             // Sassolo  -> Geodude/Golem
 25:50,26:51,             // Talpino  -> Diglett/Dugtrio
 27:116,28:117,           // Pinnello -> Horsea/Seadra
 29:92,30:93,31:94,       // Ombrino  -> Gastly/Haunter/Gengar
 32:63,33:65,             // Mentino  -> Abra/Alakazam
 34:66,35:68,             // Pugnetto -> Machop/Machamp
 36:88,37:89,             // Tossino  -> Grimer/Muk
 38:361,39:362,           // Gelino   -> Snorunt/Glalie
 40:216,41:217,           // Orsetto  -> Teddiursa/Ursaring
 42:41,43:169,            // Pipistro -> Zubat/Crobat
 44:218,45:219,           // Lavillo  -> Slugma/Magcargo (Fuoco/Roccia)
 46:371,47:372,48:373,    // Draghetto-> Bagon/Shelgon/Salamence
 49:171,                  // Voltanguil-> Lanturn (Elettro/Acqua)
 50:337,                  // Statuo   -> Lunatone (Roccia/Psico)
 51:478,                  // Nebbiolo -> Froslass (Ghiaccio/Spettro)
 52:335,                  // Leonzio  -> Zangoose
 53:272,                  // Tritone  -> Ludicolo (Acqua/Erba)
 54:249                   // Solverio -> Lugia (Psico/Volante)
};
const SPRITE_BASE='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const imgCache={};
function monImg(id,back){
 const key=id+(back?'b':'f');
 if(imgCache[key])return imgCache[key];
 const img=new Image();
 img.crossOrigin='anonymous';
 img.src=SPRITE_BASE+(back?'back/':'')+SPRITE_IDS[id]+'.png';
 imgCache[key]=img;
 return img;
}
function imgReady(img){ return img.complete&&img.naturalWidth>0; }
function drawMon(g,id,x,y,w,h){
 const img=monImg(id,false);
 g.imageSmoothingEnabled=false;
 if(imgReady(img))g.drawImage(img,x,y,w,h);
 else g.drawImage(monSprite(id),x,y,w,h);
}
function drawMonBack(g,id,x,y,w,h){
 const img=monImg(id,true);
 g.imageSmoothingEnabled=false;
 if(imgReady(img))g.drawImage(img,x,y,w,h);
 else { const c=monSprite(id); g.drawImage(c,0,0,48,30,x+w*0.1,y+h*0.25,w*0.8,h*0.55); }
}
function preloadSprites(){
 for(const id in SPRITE_IDS){ monImg(+id,false); monImg(+id,true); }
}

// personaggi: disegno diretto (testa/corpo/gambe)
const NPC_PAL={
 0:{hat:null,hair:'#5a3a1a',shirt:'#d05050',pants:'#3a5a8a'},
 1:{hat:null,hair:'#222',shirt:'#50a050',pants:'#555'},
 2:{hat:null,hair:'#c8a030',shirt:'#9060c0',pants:'#333'},
 3:{hat:null,hair:'#888',shirt:'#c87830',pants:'#4a4a6a'},
 4:{hat:'#3a5a8a',hair:'#222',shirt:'#3a5a8a',pants:'#222'},
 P:{hat:null,hair:'#aaa',shirt:'#f0f0f0',pants:'#6a5a3a'},
 N:{hat:'#f080a0',hair:'#e05070',shirt:'#f8b8c8',pants:'#fff'},
 M:{hat:null,hair:'#333',shirt:'#4878d0',pants:'#333'},
 T:{hat:'#c03028',hair:'#222',shirt:'#c03028',pants:'#3a3a3a'},
 L:{hat:null,hair:'#f8d030',shirt:'#e07830',pants:'#333'},
 E:{hat:null,hair:'#9060c0',shirt:'#38385a',pants:'#222'},
 C:{hat:null,hair:'#e0c060',shirt:'#f0f0f8',pants:'#803030'},
 HERO:{hat:'#d84040',hair:'#4a2a10',shirt:'#e05048',pants:'#3a5a8a'}
};
function drawActor(g,sx,sy,dir,frame,pal){
 // 32x32 a schermo, ancorato al tile (leggermente più alto)
 const P=NPC_PAL[pal]||NPC_PAL[0];
 sy-=8;
 g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(sx+7,sy+34,18,4);
 // gambe
 const lo=frame%2===1?2:0;
 g.fillStyle=P.pants;
 g.fillRect(sx+9,sy+24+ (dir===3?0:0),5,8-lo);
 g.fillRect(sx+18,sy+24,5,8-(lo?0:2));
 // corpo
 g.fillStyle=P.shirt; g.fillRect(sx+7,sy+14,18,11);
 // braccia
 g.fillRect(sx+4,sy+15,4,8); g.fillRect(sx+24,sy+15,4,8);
 g.fillStyle='#f0c8a0'; g.fillRect(sx+4,sy+22,4,3); g.fillRect(sx+24,sy+22,4,3);
 // testa
 g.fillStyle='#f0c8a0'; g.fillRect(sx+8,sy+2,16,13);
 // capelli / cappello
 g.fillStyle=P.hat||P.hair;
 g.fillRect(sx+7,sy,18,5);
 if(P.hat){ g.fillRect(sx+5,sy+4,22,2); }
 else g.fillRect(sx+7,sy+4,3,4), g.fillRect(sx+22,sy+4,3,4);
 // occhi per direzione
 g.fillStyle='#222';
 if(dir===2){ g.fillRect(sx+12,sy+8,2,3); g.fillRect(sx+18,sy+8,2,3);}
 else if(dir===0){ /* spalle */ g.fillStyle=P.hat||P.hair; g.fillRect(sx+8,sy+2,16,8); }
 else if(dir===1){ g.fillRect(sx+11,sy+8,2,3); }
 else if(dir===3){ g.fillRect(sx+19,sy+8,2,3); }
}

// ================================================================
// PARTE 4 — Stato di gioco, overworld, dialoghi
// ================================================================
const GS = {
 mode:'title', map:'world', px:0, py:0, dir:2, moving:false, mvx:0, mvy:0, mvt:0,
 party:[], box:[], bag:{sfera:5,pozione:3}, money:3000, badges:[], defeated:{}, flags:{},
 dex:{seen:{},caught:{}}, steps:0, anim:0, name:'ALEX'
};
let dialogQ=null, menuState=null, battle=null, fade=0, fadeCb=null;

function statCalc(base,lv,isHp){ return isHp? Math.floor(base*2*lv/100)+lv+10 : Math.floor(base*2*lv/100)+5; }
function mkMon(id,lv){
 const sp=SP(id);
 const m={id, lv, exp:lv*lv*lv, status:null, stages:{atk:0,def:0,spe:0}, moves:[]};
 const learn=sp.mv.filter(x=>x[0]<=lv).slice(-4);
 for(const [,k] of learn) m.moves.push({k, pp:MOVES[k].pp});
 recalcStats(m); m.hp=m.maxhp;
 return m;
}
function recalcStats(m){
 const sp=SP(m.id);
 const old=m.maxhp||0;
 m.maxhp=statCalc(sp.bs[0],m.lv,true);
 m.atk=statCalc(sp.bs[1],m.lv);
 m.def=statCalc(sp.bs[2],m.lv);
 m.spe=statCalc(sp.bs[3],m.lv);
 if(old&&m.hp!==undefined) m.hp=Math.min(m.maxhp, m.hp+(m.maxhp-old));
}
function expForLv(lv){ return lv*lv*lv; }

function curMap(){ return MAPS[GS.map]; }
function tileAt(x,y){ return G(curMap(),x,y); }
function npcAt(x,y){ return curMap().npcs.find(n=>n.x===x&&n.y===y && !(n.hidden)); }
function isBlocked(x,y){
 const t=tileAt(x,y);
 if(SOLID.has(t))return true;
 const n=npcAt(x,y);
 if(n){ if(n.blockUntilBeat && GS.defeated[n.trainer.id]) return false; return true; }
 return false;
}
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]]; // 0 su,1 dx,2 giù,3 sx

function tryMove(d){
 GS.dir=d;
 const [dx,dy]=DIRS[d], nx=GS.px+dx, ny=GS.py+dy;
 if(isBlocked(nx,ny))return;
 GS.moving=true; GS.mvx=nx; GS.mvy=ny; GS.mvt=0;
}
function arrive(){
 GS.px=GS.mvx; GS.py=GS.mvy; GS.moving=false; GS.steps++;
 const t=tileAt(GS.px,GS.py);
 const wkey=GS.px+','+GS.py;
 const warp=curMap().warps[wkey];
 if((t===8||t===12)&&warp){ doWarp(warp); return; }
 if(t===1 && GS.map==='world'){
  const z=ZONE[GS.py*WORLD_W+GS.px];
  if(z>0 && R()<.12) startWild(z-1);
 }
}
function doWarp(w){
 fadeOut(()=>{ GS.map=w.map; GS.px=w.x; GS.py=w.y; GS.moving=false;
  if(w.map!=='world')GS.dir=0; else GS.dir=2; fadeIn(); });
}
function fadeOut(cb){ fade=0.01; fadeCb=cb; }
function fadeIn(){ fade=-1; }

function interact(){
 const [dx,dy]=DIRS[GS.dir], tx=GS.px+dx, ty=GS.py+dy;
 const t=tileAt(tx,ty);
 const skey=tx+','+ty;
 let n=npcAt(tx,ty);
 // si può parlare oltre i banconi (15) e le macchine (16), come al Centro Cure o al market
 if(!n&&(t===15||t===16))n=npcAt(tx+dx,ty+dy);
 if(n){ n.dir=(GS.dir+2)%4; npcAction(n); return; }
 if(t===7 && curMap().signs[skey]){ say(curMap().signs[skey]); return; }
 if(t===20){ altare(); return; }
 if(t===17){ pcBox(); return; }
}
function npcAction(n){
 if(n.nurse){
  say('Benvenuto nel Centro Cure! Rimetto in forze la tua squadra?', ()=>{
   for(const m of GS.party){ m.hp=m.maxhp; m.status=null; for(const mv of m.moves)mv.pp=MOVES[mv.k].pp; }
   sfx('heal');
   const ti=parseInt(GS.map.replace('center',''),10);
   if(!isNaN(ti))GS.lastHeal={map:'world',x:TOWNS[ti].x,y:TOWNS[ti].y+1};
   say('Ecco fatto! Le tue creature sono in piena forma. A presto!');
  });
  return;
 }
 if(n.shop!==undefined){ openShop(); return; }
 if(n.prof){ profTalk(); return; }
 if(n.guard){
  if(GS.badges.length>=8){ say('Hai tutte le 8 medaglie! La Via della Lega è aperta. Buona fortuna, campione!'); n.hidden=true; GS.flags.guardGone=true; }
  else say(n.text+' (Medaglie: '+GS.badges.length+'/8)');
  return;
 }
 if(n.trainer){
  const tr=n.trainer;
  if(GS.defeated[tr.id]){ say(tr.l); return; }
  say(tr.name+': "'+tr.t+'"', ()=>startTrainerBattle(tr));
  return;
 }
 say(n.text||'...');
}
function altare(){
 if(GS.flags.solverio){ say('L\'altare è silenzioso. La leggenda si è già compiuta.'); return; }
 say('Una luce accecante avvolge l\'altare... SOLVERIO, il custode di Valmora, si risveglia!', ()=>{
  GS.flags.solverio=true;
  startWildMon(mkMon(54,50), 8);
 });
}
function profTalk(){
 if(!GS.flags.starter){
  say('Prof. Cedro: "Benvenuto, '+GS.name+'! Il mondo di Valmora pullula di creature straordinarie. Scegline una: sarà la tua compagna di viaggio!"', ()=>{
   menuState={kind:'starter', sel:0};
   GS.mode='menu';
  });
 } else if(GS.badges.length>=8 && !GS.flags.champion){
  say('Prof. Cedro: "Otto medaglie! Straordinario! La Lega Valmora ti attende a nord-ovest. Rendi orgogliosa Borgofoglia!"');
 } else if(GS.flags.champion){
  say('Prof. Cedro: "Il Campione di Valmora in persona! Il tuo Dex conta '+Object.keys(GS.dex.caught).length+' creature catturate su 54. La ricerca continua!"');
 } else {
  say('Prof. Cedro: "Come procede il viaggio? Le palestre ti metteranno alla prova. E riempi il Dex per me!"');
 }
}
function pcBox(){
 if(GS.box.length===0 && GS.party.length===0){ say('Il PC è acceso... ma non c\'è nulla da fare.'); return; }
 menuState={kind:'box', sel:0, mode:'menu'}; GS.mode='menu'; sfx('menu');
}

// ---------- dialoghi ----------
function say(txt, cb){
 dialogQ={lines: wrapText(txt, 54), shown:0, t:0, cb};
 GS.mode='dialog';
}
function wrapText(txt,n){
 const words=String(txt).split(' '); const lines=[]; let cur='';
 for(const w of words){ if((cur+' '+w).trim().length>n){ lines.push(cur.trim()); cur=w; } else cur+=' '+w; }
 if(cur.trim())lines.push(cur.trim());
 return lines;
}
function advanceDialog(){
 if(!dialogQ)return;
 const totalChars=dialogQ.lines.join(' ').length;
 if(dialogQ.shown<totalChars){ dialogQ.shown=totalChars; return; }
 const d=dialogQ; dialogQ=null;
 if(GS.mode==='dialog') GS.mode = battle? 'battle':'world';
 if(d.cb)d.cb();
}
// ================================================================
// PARTE 5 — Input, menu, ciclo principale
// ================================================================
const keys={}; const pressQ=[];
function initInput(){
 addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  if(e.repeat)return;
  keys[e.key]=true;
  const k=e.key.toLowerCase();
  if(k==='z'||k===' '||k==='e') pressQ.push('A');
  else if(k==='x'||k==='escape') pressQ.push('B');
  else if(k==='enter') pressQ.push('S');
  else if(k==='arrowup'||k==='w') pressQ.push('U');
  else if(k==='arrowdown'||k==='s') pressQ.push('D');
  else if(k==='arrowleft'||k==='a') pressQ.push('L');
  else if(k==='arrowright'||k==='d') pressQ.push('R');
  else if(k==='m') SND.mute=!SND.mute;
 });
 addEventListener('keyup',e=>{keys[e.key]=false;});
}
function heldDir(){
 if(keys['ArrowUp']||keys['w'])return 0;
 if(keys['ArrowRight']||keys['d'])return 1;
 if(keys['ArrowDown']||keys['s'])return 2;
 if(keys['ArrowLeft']||keys['a'])return 3;
 return -1;
}

// ---------- suoni (WebAudio) ----------
const SND={ctx:null,mute:false};
function sfx(kind){
 if(SND.mute)return;
 try{
  if(!SND.ctx)SND.ctx=new (window.AudioContext||window.webkitAudioContext)();
  const ac=SND.ctx, o=ac.createOscillator(), g=ac.createGain();
  o.connect(g); g.connect(ac.destination);
  const t=ac.currentTime; g.gain.value=.08;
  const P={menu:[440,.06],a:[660,.07],b:[330,.07],hit:[180,.12],super:[120,.16],heal:[880,.3],
    lvl:[523,.4],catch:[392,.35],faint:[98,.4],run:[700,.1],badge:[659,.5]};
  const [f,d]=P[kind]||P.menu;
  o.type= kind==='hit'||kind==='super'||kind==='faint' ? 'sawtooth':'square';
  o.frequency.setValueAtTime(f,t);
  if(kind==='heal'||kind==='lvl'||kind==='badge'){o.frequency.setValueAtTime(f,t);o.frequency.setValueAtTime(f*1.25,t+d/3);o.frequency.setValueAtTime(f*1.5,t+2*d/3);}
  if(kind==='catch'){o.frequency.setValueAtTime(f,t);o.frequency.setValueAtTime(f*.75,t+d/2);}
  if(kind==='faint'){o.frequency.linearRampToValueAtTime(40,t+d);}
  g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.start(t); o.stop(t+d);
 }catch(e){}
}

// ---------- menu ----------
function openStartMenu(){ menuState={kind:'start',sel:0}; GS.mode='menu'; sfx('menu'); }
function openShop(){ menuState={kind:'shop',sel:0}; GS.mode='menu'; sfx('menu'); }
const START_ITEMS=['DEX','SQUADRA','ZAINO','ALLENATORE','SALVA','CHIUDI'];

function bagList(){ return Object.keys(GS.bag).filter(k=>GS.bag[k]>0); }

function menuInput(ev){
 const M=menuState;
 if(!M)return;
 if(M.kind==='start'){
  if(ev==='U'){M.sel=(M.sel+5)%6;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%6;sfx('menu');}
  else if(ev==='B'||ev==='S'){GS.mode='world';menuState=null;sfx('b');}
  else if(ev==='A'){
   sfx('a');
   const it=START_ITEMS[M.sel];
   if(it==='DEX')menuState={kind:'dex',sel:0};
   else if(it==='SQUADRA')menuState={kind:'party',sel:0,ctx:'world'};
   else if(it==='ZAINO')menuState={kind:'bag',sel:0,ctx:'world'};
   else if(it==='ALLENATORE')menuState={kind:'card'};
   else if(it==='SALVA'){saveGame();say('Partita salvata! (Suggerimento: puoi anche esportarla in file dal pulsante sotto lo schermo.)');menuState=null;}
   else {GS.mode='world';menuState=null;}
  }
 }
 else if(M.kind==='card'){ if(ev==='A'||ev==='B'){menuState={kind:'start',sel:3};sfx('b');} }
 else if(M.kind==='dex'){
  if(ev==='U'){M.sel=Math.max(0,M.sel-1);sfx('menu');}
  else if(ev==='D'){M.sel=Math.min(DEX.length-1,M.sel+1);sfx('menu');}
  else if(ev==='B'){menuState={kind:'start',sel:0};sfx('b');}
 }
 else if(M.kind==='party'){
  const n=GS.party.length;
  if(ev==='U'){M.sel=(M.sel+n-1)%n;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%n;sfx('menu');}
  else if(ev==='B'){
   sfx('b');
   if(M.ctx==='world')menuState={kind:'start',sel:1};
   else if(M.ctx==='item')menuState={kind:'bag',sel:M.bagSel||0,ctx:M.itemCtx};
   else if(M.ctx==='switch'&&M.force){/* switch obbligatorio: non si annulla */}
   else if(M.ctx==='switch'){menuState=null;GS.mode='battle';battleMenuBack();}
  }
  else if(ev==='A'){
   sfx('a');
   const mon=GS.party[M.sel];
   if(M.ctx==='world'){ menuState={kind:'partyAct',sel:0,monSel:M.sel}; }
   else if(M.ctx==='item'){ useItemOn(M.item, M.sel, M.itemCtx); }
   else if(M.ctx==='switch'){
    if(mon.hp<=0){say('È esausto! Non può lottare!');}
    else if(battle && battle.you===mon){say('È già in campo!');}
    else doSwitch(M.sel);
   }
  }
 }
 else if(M.kind==='partyAct'){
  if(ev==='U'||ev==='D'){M.sel=1-M.sel;sfx('menu');}
  else if(ev==='B'){menuState={kind:'party',sel:M.monSel,ctx:'world'};sfx('b');}
  else if(ev==='A'){
   sfx('a');
   if(M.sel===0)menuState={kind:'stats',monSel:M.monSel};
   else menuState={kind:'swap',from:M.monSel,sel:M.monSel};
  }
 }
 else if(M.kind==='stats'){ if(ev==='A'||ev==='B'){menuState={kind:'party',sel:M.monSel,ctx:'world'};sfx('b');} }
 else if(M.kind==='swap'){
  const n=GS.party.length;
  if(ev==='U'){M.sel=(M.sel+n-1)%n;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%n;sfx('menu');}
  else if(ev==='B'){menuState={kind:'party',sel:M.from,ctx:'world'};sfx('b');}
  else if(ev==='A'){
   const t=GS.party[M.from];GS.party[M.from]=GS.party[M.sel];GS.party[M.sel]=t;
   sfx('a'); menuState={kind:'party',sel:M.sel,ctx:'world'};
  }
 }
 else if(M.kind==='bag'){
  const list=bagList();
  if(list.length===0){ if(ev)menuState= M.ctx==='battle'?null:{kind:'start',sel:2}; if(M.ctx==='battle'){GS.mode='battle';battleMenuBack();} return; }
  if(ev==='U'){M.sel=(M.sel+list.length-1)%list.length;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%list.length;sfx('menu');}
  else if(ev==='B'){
   sfx('b');
   if(M.ctx==='battle'){menuState=null;GS.mode='battle';battleMenuBack();}
   else menuState={kind:'start',sel:2};
  }
  else if(ev==='A'){
   const k=list[M.sel], it=ITEMS[k];
   sfx('a');
   if(it.ball){
    if(M.ctx==='battle') throwBall(k);
    else say('Non è il momento di usarla!');
   } else {
    menuState={kind:'party',sel:0,ctx:'item',item:k,itemCtx:M.ctx,bagSel:M.sel};
   }
  }
 }
 else if(M.kind==='starter'){
  if(ev==='L'){M.sel=(M.sel+2)%3;sfx('menu');}
  else if(ev==='R'){M.sel=(M.sel+1)%3;sfx('menu');}
  else if(ev==='A'){
   const ids=[1,4,7], id=ids[M.sel];
   sfx('catch');
   const mon=mkMon(id,5);
   GS.party.push(mon); GS.flags.starter=true;
   GS.dex.seen[id]=1; GS.dex.caught[id]=1;
   menuState=null;
   say('Hai scelto '+SP(id).n+'! Il Prof. Cedro ti regala anche 5 Valsfere e 3 Pozioni. Che il viaggio abbia inizio!',()=>{GS.mode='world';});
  }
 }
 else if(M.kind==='shop'){
  const stock=shopStock(GS.badges.length);
  const tot=stock.length+1;
  if(ev==='U'){M.sel=(M.sel+tot-1)%tot;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%tot;sfx('menu');}
  else if(ev==='B'){sfx('b');menuState=null;GS.mode='world';}
  else if(ev==='A'){
   if(M.sel>=stock.length){sfx('b');menuState=null;GS.mode='world';return;}
   const k=stock[M.sel], it=ITEMS[k];
   if(GS.money>=it.buy){ GS.money-=it.buy; GS.bag[k]=(GS.bag[k]||0)+1; sfx('catch'); }
   else sfx('b');
  }
 }
 else if(M.kind==='box'){
  const n=GS.party.length+GS.box.length;
  if(ev==='U'){M.sel=(M.sel+n-1)%n;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%n;sfx('menu');}
  else if(ev==='B'){sfx('b');menuState=null;GS.mode='world';}
  else if(ev==='A'){
   sfx('a');
   if(M.sel<GS.party.length){
    if(GS.party.length<=1){say('Non puoi depositare l\'ultima creatura della squadra!');return;}
    const mon=GS.party.splice(M.sel,1)[0]; GS.box.push(mon);
   } else {
    if(GS.party.length>=6){say('La squadra è al completo (6)!');return;}
    const mon=GS.box.splice(M.sel-GS.party.length,1)[0]; mon.hp=mon.maxhp; GS.party.push(mon);
   }
   M.sel=0;
  }
 }
 else if(M.kind==='learn'){
  if(ev==='U'){M.sel=(M.sel+4)%5;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%5;sfx('menu');}
  else if(ev==='A'){
   const mon=M.mon;
   if(M.sel<4){
    const old=MOVES[mon.moves[M.sel].k].n;
    mon.moves[M.sel]={k:M.move,pp:MOVES[M.move].pp};
    sfx('lvl'); menuState=null;
    say(mon&&SP(mon.id).n+' dimentica '+old+' e impara '+MOVES[M.move].n+'!', M.cb);
   } else { sfx('b'); menuState=null; say(SP(M.mon.id).n+' non impara '+MOVES[M.move].n+'.', M.cb); }
  }
 }
}
function useItemOn(k, idx, ctx){
 const it=ITEMS[k], mon=GS.party[idx];
 let ok=false, msg='';
 if(it.heal){
  if(mon.hp<=0)msg='È esausto! Serve un Revitalizzante.';
  else if(mon.hp>=mon.maxhp)msg='Ha già tutti i PS!';
  else { mon.hp=Math.min(mon.maxhp,mon.hp+it.heal); ok=true; msg=SP(mon.id).n+' recupera PS!'; }
 } else if(it.cure){
  if(mon.hp<=0)msg='È esausto!';
  else if(!mon.status)msg='Non ha stati alterati!';
  else if(it.cure==='ALL'||it.cure===mon.status){ mon.status=null; ok=true; msg=SP(mon.id).n+' sta di nuovo bene!'; }
  else msg='Non è la cura giusta!';
 } else if(it.revive){
  if(mon.hp>0)msg='Non è esausto!';
  else { mon.hp=Math.floor(mon.maxhp*it.revive); mon.status=null; ok=true; msg=SP(mon.id).n+' si rianima!'; }
 }
 if(ok){ GS.bag[k]--; sfx('heal'); }
 menuState=null;
 if(ctx==='battle'&&ok){ say(msg, ()=>{ battleItemUsed(); }); }
 else say(msg, ctx==='battle'? ()=>{GS.mode='battle';battleMenuBack();} : null);
}

// ---------- ciclo principale ----------
let lastT=0;
function loop(ts){
 const dt=Math.min(50,ts-lastT); lastT=ts;
 GS.anim+=dt;
 update(dt);
 draw();
 requestAnimationFrame(loop);
}
function update(dt){
 // dissolvenze
 if(fade>0){ fade+=dt/300; if(fade>=1){fade=1; const cb=fadeCb; fadeCb=null; if(cb)cb();} return; }
 if(fade===-1){ fade=-0.99; }
 if(fade<0){ fade+=dt/300; if(fade>=0)fade=0; }
 const ev=pressQ.shift();
 if(GS.mode==='title'){ if(ev==='A'||ev==='S'){ titleAction(); } return; }
 if(GS.mode==='dialog'){ if(ev==='A'||ev==='B'){ advanceDialog(); sfx('a'); } if(dialogQ)dialogQ.t+=dt; if(dialogQ)dialogQ.shown+=dt*.06; return; }
 if(GS.mode==='menu'){ menuInput(ev); return; }
 if(GS.mode==='battle'){ battleUpdate(dt, ev); return; }
 if(GS.mode==='world'){
  if(ev==='S'){ openStartMenu(); return; }
  if(ev==='A'){ interact(); return; }
  if(GS.moving){
   GS.mvt+=dt/180;
   if(GS.mvt>=1){ arrive(); }
  } else {
   const d=heldDir();
   if(d>=0)tryMove(d);
  }
 }
}

// ---------- disegno ----------
function draw(){
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#000'; ctx.fillRect(0,0,VW,VH);
 if(GS.mode==='title'){ drawTitle(); drawFade(); return; }
 if(GS.mode==='battle'||battle){ drawBattle(); if(GS.mode==='dialog')drawDialog(); drawFade(); return; }
 drawWorld();
 if(GS.mode==='dialog')drawDialog();
 if(GS.mode==='menu')drawMenu();
 drawFade();
}
function drawFade(){
 const f=Math.abs(fade);
 if(f>0.001){ ctx.fillStyle='rgba(0,0,0,'+f+')'; ctx.fillRect(0,0,VW,VH); }
}
function camPos(){
 const m=curMap();
 let cx=GS.px*TD+TD/2, cy=GS.py*TD+TD/2;
 if(GS.moving){ const t=GS.mvt; cx=(GS.px+(GS.mvx-GS.px)*t)*TD+TD/2; cy=(GS.py+(GS.mvy-GS.py)*t)*TD+TD/2; }
 let ox=cx-VW/2, oy=cy-VH/2;
 const mw=m.w*TD, mh=m.h*TD;
 if(mw<=VW)ox=(mw-VW)/2; else ox=Math.max(0,Math.min(mw-VW,ox));
 if(mh<=VH)oy=(mh-VH)/2; else oy=Math.max(0,Math.min(mh-VH,oy));
 return [ox,oy];
}
function drawWorld(){
 const m=curMap(); const [ox,oy]=camPos();
 const x0=Math.floor(ox/TD)-1, y0=Math.floor(oy/TD)-1;
 const x1=x0+Math.ceil(VW/TD)+2, y1=y0+Math.ceil(VH/TD)+2;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  let t=G(m,x,y);
  if(t===5 && Math.floor(GS.anim/600)%2===1) t=5; // acqua (placeholder anim)
  ctx.drawImage(renderTile(t), x*TD-ox, y*TD-oy, TD, TD);
 }
 // npc
 for(const n of m.npcs){
  if(n.hidden)continue;
  drawActor(ctx, n.x*TD-ox, n.y*TD-oy, n.dir, 0, n.spr);
 }
 // giocatore
 let pxx=GS.px, pyy=GS.py;
 if(GS.moving){ const t=GS.mvt; pxx=GS.px+(GS.mvx-GS.px)*t; pyy=GS.py+(GS.mvy-GS.py)*t; }
 const frame=GS.moving? (Math.floor(GS.anim/140)%2+1):0;
 drawActor(ctx, pxx*TD-ox, pyy*TD-oy, GS.dir, frame, 'HERO');
}
function box(x,y,w,h,opts){
 ctx.fillStyle=(opts&&opts.bg)||'#f8f8e8';
 ctx.fillRect(x,y,w,h);
 ctx.strokeStyle='#385890'; ctx.lineWidth=3; ctx.strokeRect(x+1.5,y+1.5,w-3,h-3);
 ctx.strokeStyle='#88a8d8'; ctx.lineWidth=1; ctx.strokeRect(x+4.5,y+4.5,w-9,h-9);
}
function txt(s,x,y,col,size,bold){
 ctx.fillStyle=col||'#303030';
 ctx.font=(bold===false?'':'bold ')+(size||13)+'px monospace';
 ctx.textBaseline='top';
 ctx.fillText(s,x,y);
}
function drawDialog(){
 box(8,VH-72,VW-16,64);
 if(!dialogQ)return;
 let budget=Math.floor(dialogQ.shown);
 let y=VH-60;
 for(const line of dialogQ.lines.slice(0,3)){
  const s=line.slice(0,Math.max(0,budget));
  budget-=line.length;
  txt(s,20,y); y+=16;
 }
 if(dialogQ.lines.length>3&&budget>0){ txt('▼',VW-34,VH-24,'#c03028'); }
 else if(budget>0){ if(Math.floor(GS.anim/400)%2)txt('▼',VW-34,VH-24,'#c03028'); }
}
function hpColor(r){ return r>.5?'#30c020': r>.2?'#e8a020':'#e03028'; }
function hpBar(x,y,w,mon){
 ctx.fillStyle='#585858'; ctx.fillRect(x,y,w,8);
 const r=Math.max(0,mon.hp)/mon.maxhp;
 ctx.fillStyle=hpColor(r); ctx.fillRect(x+1,y+1,(w-2)*r,6);
}
const ST_COL={PSN:'#a040a0',PAR:'#f8d030',SLP:'#a8a878',BRN:'#f08030',FRZ:'#98d8d8'};
const ST_TXT={PSN:'VEL',PAR:'PAR',SLP:'SON',BRN:'BRU',FRZ:'GEL'};
function statusTag(mon,x,y){
 if(!mon.status)return;
 ctx.fillStyle=ST_COL[mon.status]; ctx.fillRect(x,y,30,12);
 txt(ST_TXT[mon.status],x+3,y+1,'#fff',10);
}
function drawMenu(){
 const M=menuState; if(!M)return;
 if(M.kind==='start'){
  drawWorldBehind();
  box(VW-150,8,142,150);
  START_ITEMS.forEach((it,i)=>{
   if(i===M.sel)txt('▶',VW-142,18+i*23,'#c03028');
   txt(it,VW-126,18+i*23);
  });
 }
 else if(M.kind==='card'){
  drawWorldBehind(); box(40,40,VW-80,VH-80);
  txt('TESSERA ALLENATORE',60,58,'#385890',15);
  txt('Nome: '+GS.name,60,90);
  txt('Soldi: '+GS.money+'¤',60,112);
  txt('Dex: visti '+Object.keys(GS.dex.seen).length+'  catturati '+Object.keys(GS.dex.caught).length,60,134);
  txt('Medaglie: '+GS.badges.length+'/8',60,156);
  let bx=60;
  for(let i=1;i<=8;i++){
   ctx.fillStyle=GS.badges.includes(i)?TYPES[TOWNS[i].gym.type].c:'#ccc';
   ctx.beginPath();ctx.arc(bx+10,190,9,0,7);ctx.fill();
   ctx.strokeStyle='#555';ctx.stroke();
   bx+=30;
  }
  txt('Campione di Valmora: '+(GS.flags.champion?'SÌ!':'non ancora'),60,215);
 }
 else if(M.kind==='dex'){
  box(8,8,190,VH-16); box(200,8,VW-208,VH-16);
  txt('VALDEX',20,18,'#385890',15);
  const top=Math.max(0,Math.min(M.sel-5,DEX.length-11));
  for(let i=top;i<Math.min(DEX.length,top+11);i++){
   const sp=DEX[i], caught=GS.dex.caught[sp.id], seen=GS.dex.seen[sp.id];
   const y=42+(i-top)*22;
   if(i===M.sel)txt('▶',14,y,'#c03028');
   txt(String(sp.id).padStart(2,'0')+' '+(caught?sp.n:(seen?sp.n+' ?':'---')),30,y,caught?'#303030':'#909090');
  }
  const sp=DEX[M.sel];
  if(GS.dex.seen[sp.id]){
   drawMon(ctx,sp.id,240,40,96,96);
   txt(sp.n,220,150,'#303030',15);
   let tx=220;
   for(const t of sp.t){ ctx.fillStyle=TYPES[t].c; ctx.fillRect(tx,172,64,16); txt(TYPES[t].n,tx+4,174,'#fff',11); tx+=70; }
   if(GS.dex.caught[sp.id]){
    txt('PS:'+sp.bs[0]+' ATT:'+sp.bs[1],220,200);
    txt('DIF:'+sp.bs[2]+' VEL:'+sp.bs[3],220,218);
    txt(sp.ev?('Si evolve al liv. '+sp.ev.lv):'Non si evolve',220,240,'#385890',12);
   } else txt('Catturalo per i dettagli!',220,200,'#909090',12);
  } else txt('???',270,90,'#909090',30);
 }
 else if(M.kind==='party'||M.kind==='swap'){
  if(battle)drawBattle(); else drawWorldBehind();
  box(8,8,VW-16,VH-16);
  txt(M.kind==='swap'?'Con chi lo scambi?':'SQUADRA',24,18,'#385890',15);
  GS.party.forEach((mon,i)=>{
   const y=42+i*44, sp=SP(mon.id);
   if(i===M.sel)txt('▶',16,y+8,'#c03028');
   if(M.kind==='swap'&&i===M.from)txt('●',16,y+8,'#3858c0');
   drawMon(ctx,mon.id,32,y,36,36);
   txt(sp.n+'  L'+mon.lv,76,y+2);
   hpBar(76,y+20,140,mon);
   txt(mon.hp+'/'+mon.maxhp,226,y+18,'#303030',11);
   statusTag(mon,300,y+16);
   if(mon.hp<=0){txt('KO',300,y+2,'#c03028',12);}
  });
 }
 else if(M.kind==='partyAct'){
  drawWorldBehind(); box(VW-150,VH-100,142,88);
  ['VEDI','SPOSTA'].forEach((s,i)=>{ if(i===M.sel)txt('▶',VW-142,VH-86+i*24,'#c03028'); txt(s,VW-126,VH-86+i*24); });
 }
 else if(M.kind==='stats'){
  const mon=GS.party[M.monSel], sp=SP(mon.id);
  box(8,8,VW-16,VH-16);
  drawMon(ctx,mon.id,40,40,96,96);
  txt(sp.n+'   Liv.'+mon.lv,40,150,'#303030',16);
  let tx=40; for(const t of sp.t){ ctx.fillStyle=TYPES[t].c; ctx.fillRect(tx,176,64,16); txt(TYPES[t].n,tx+4,178,'#fff',11); tx+=70; }
  txt('PS  '+mon.hp+'/'+mon.maxhp,40,204);
  txt('ATT '+mon.atk+'   DIF '+mon.def+'   VEL '+mon.spe,40,224);
  txt('Esp. '+mon.exp+'  (prossimo liv: '+(expForLv(mon.lv+1)-mon.exp)+')',40,244);
  txt('MOSSE',240,40,'#385890',14);
  mon.moves.forEach((mv,i)=>{
   const mo=MOVES[mv.k];
   txt(mo.n,240,66+i*40);
   ctx.fillStyle=TYPES[mo.t].c; ctx.fillRect(240,82+i*40,50,13); txt(TYPES[mo.t].n,243,84+i*40,'#fff',9);
   txt('PP '+mv.pp+'/'+mo.pp,300,82+i*40,'#606060',11);
  });
  statusTag(mon,150,150);
 }
 else if(M.kind==='bag'){
  if(battle)drawBattle(); else drawWorldBehind();
  box(8,8,VW-16,VH-16);
  txt('ZAINO      Soldi: '+GS.money+'¤',24,18,'#385890',15);
  const list=bagList();
  if(list.length===0)txt('Lo zaino è vuoto!',40,60,'#909090');
  list.forEach((k,i)=>{
   const y=46+i*22;
   if(i===M.sel)txt('▶',20,y,'#c03028');
   txt(ITEMS[k].n,36,y); txt('x'+GS.bag[k],200,y);
  });
  if(list[M.sel])txt(ITEMS[list[M.sel]].d,250,46,'#606060',12);
 }
 else if(M.kind==='starter'){
  box(8,8,VW-16,VH-16);
  txt('Scegli la tua prima creatura!',110,24,'#385890',16);
  const ids=[1,4,7];
  ids.forEach((id,i)=>{
   const x=60+i*130;
   if(i===M.sel){ctx.fillStyle='#fff0c0';ctx.fillRect(x-12,60,120,150);ctx.strokeStyle='#c03028';ctx.strokeRect(x-12,60,120,150);}
   drawMon(ctx,id,x,70,96,96);
   txt(SP(id).n,x+8,172);
   ctx.fillStyle=TYPES[SP(id).t[0]].c; ctx.fillRect(x+8,190,64,14); txt(TYPES[SP(id).t[0]].n,x+11,191,'#fff',10);
  });
  txt('◀ ▶ per scegliere, Z per confermare',110,240,'#606060',12);
 }
 else if(M.kind==='shop'){
  drawWorldBehind();
  box(8,8,300,VH-16); box(316,8,VW-324,80);
  txt('Soldi',330,20,'#385890'); txt(GS.money+'¤',330,44);
  txt('MARKET',24,18,'#385890',15);
  const stock=shopStock(GS.badges.length);
  stock.forEach((k,i)=>{
   const y=46+i*20;
   if(i===M.sel)txt('▶',16,y,'#c03028');
   txt(ITEMS[k].n,32,y,'#303030',12); txt(ITEMS[k].buy+'¤',220,y,'#303030',12);
  });
  const y=46+stock.length*20;
  if(M.sel>=stock.length)txt('▶',16,y,'#c03028');
  txt('ESCI',32,y,'#303030',12);
  if(stock[M.sel])txt(ITEMS[stock[M.sel]].d,330,110,'#606060',11);
 }
 else if(M.kind==='box'){
  drawWorldBehind(); box(8,8,VW-16,VH-16);
  txt('PC — Deposito creature (Z: sposta, X: esci)',24,16,'#385890',13);
  txt('SQUADRA',24,40,'#385890',12);
  GS.party.forEach((mon,i)=>{
   const y=58+i*18;
   if(M.sel===i)txt('▶',20,y,'#c03028');
   txt(SP(mon.id).n+' L'+mon.lv,36,y,'#303030',12);
  });
  txt('BOX ('+GS.box.length+')',240,40,'#385890',12);
  GS.box.slice(0,12).forEach((mon,i)=>{
   const y=58+i*18;
   if(M.sel===GS.party.length+i)txt('▶',236,y,'#c03028');
   txt(SP(mon.id).n+' L'+mon.lv,252,y,'#303030',12);
  });
 }
 else if(M.kind==='learn'){
  if(battle)drawBattle();
  box(60,40,VW-120,VH-80);
  const mon=M.mon;
  txt(SP(mon.id).n+' vuole imparare '+MOVES[M.move].n+'!',80,56,'#303030',13);
  txt('Quale mossa dimentica?',80,76,'#606060',12);
  mon.moves.forEach((mv,i)=>{
   const y=100+i*24;
   if(M.sel===i)txt('▶',80,y,'#c03028');
   txt(MOVES[mv.k].n,96,y);
  });
  if(M.sel===4)txt('▶',80,100+4*24,'#c03028');
  txt('RINUNCIA a '+MOVES[M.move].n,96,100+4*24);
 }
}
function drawWorldBehind(){ drawWorld(); ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,VW,VH); }
// ================================================================
// PARTE 6 — Combattimento a turni
// ================================================================
function firstAlive(){ return GS.party.findIndex(m=>m.hp>0); }

function startWild(routeIdx){
 const pool=ROUTE_POOLS[routeIdx];
 let tot=0; for(const [,w] of pool.pool)tot+=w;
 let r=R()*tot, pick=pool.pool[0][0];
 for(const [id,w] of pool.pool){ r-=w; if(r<=0){pick=id;break;} }
 const lv=ri(pool.lv[0],pool.lv[1]);
 startWildMon(mkMon(pick,lv), routeIdx);
}
function startWildMon(mon, routeIdx){
 GS.dex.seen[mon.id]=1;
 const yi=firstAlive(); if(yi<0)return;
 battle={kind:'wild', foe:mon, you:GS.party[yi], queue:[], phase:'msg', menuSel:0, fightSel:0,
   dhpY:GS.party[yi].hp, dhpF:mon.hp, vhpY:GS.party[yi].hp, vhpF:mon.hp, shake:0, pendingEvo:[]};
 resetStages(battle.you); resetStages(mon);
 GS.mode='battle'; sfx('super');
 bqa('Un '+SP(mon.id).n+' selvatico! (Liv.'+mon.lv+')','sendF',400);
 bqa('Vai, '+SP(battle.you.id).n+'!','sendY',400,null,()=>{ battle.phase='menu'; });
}
function startTrainerBattle(tr){
 const yi=firstAlive();
 if(yi<0){ say('Le tue creature sono esauste! Curale prima di lottare.'); return; }
 const foeParty=tr.party.map(([id,lv])=>mkMon(id,lv));
 battle={kind:'trainer', trainer:tr, foeParty, foeIdx:0, foe:foeParty[0], you:GS.party[yi],
   queue:[], phase:'msg', menuSel:0, fightSel:0, dhpY:GS.party[yi].hp, dhpF:foeParty[0].hp,
   vhpY:GS.party[yi].hp, vhpF:foeParty[0].hp, shake:0, pendingEvo:[]};
 resetStages(battle.you); resetStages(battle.foe);
 GS.dex.seen[battle.foe.id]=1;
 GS.mode='battle'; sfx('super');
 bq(tr.name+' ti sfida!');
 bqa(tr.name+' manda in campo '+SP(battle.foe.id).n+'!','sendF',400);
 bqa('Vai, '+SP(battle.you.id).n+'!','sendY',400,null,()=>{ battle.phase='menu'; });
}
function resetStages(m){ m.stages={atk:0,def:0,spe:0}; m.slpTurns=0; }
function bq(txt, fn, after){ battle.queue.push({txt, fn, after, applied:false}); battle.phase='msg'; }
function bqa(txt,type,dur,fn,after){ battle.queue.push({txt,anim:{type,dur},fn,after,applied:false}); battle.phase='msg'; }
function bqanim(type,dur,fn,after){ battle.queue.push({txt:null,anim:{type,dur},fn,after,applied:false}); battle.phase='msg'; }
function drawBall(g,x,y,r,tilt){
 g.save(); g.translate(x,y); g.rotate(tilt||0);
 g.beginPath(); g.arc(0,0,r,Math.PI,0); g.fillStyle='#e03028'; g.fill();
 g.beginPath(); g.arc(0,0,r,0,Math.PI); g.fillStyle='#f8f8f8'; g.fill();
 g.fillStyle='#303030'; g.fillRect(-r,-2,2*r,4);
 g.beginPath(); g.arc(0,0,r*0.3,0,7); g.fillStyle='#f8f8f8'; g.fill();
 g.strokeStyle='#303030'; g.lineWidth=1.5; g.beginPath(); g.arc(0,0,r*0.3,0,7); g.stroke();
 g.beginPath(); g.arc(0,0,r,0,7); g.stroke();
 g.restore();
}

function stageMult(s){ return s>=0? (2+s)/2 : 2/(2-s); }
function effAtk(m){ let a=m.atk*stageMult(m.stages.atk); if(m.status==='BRN')a*=.5; return a; }
function effDef(m){ return m.def*stageMult(m.stages.def); }
function effSpe(m){ let s=m.spe*stageMult(m.stages.spe); if(m.status==='PAR')s*=.25; return s; }

function battleMenuBack(){ if(battle)battle.phase='menu'; }

function battleUpdate(dt, ev){
 const b=battle; if(!b)return;
 // animazione barre PS
 const lerp=(cur,tgt)=>{ const d=tgt-cur; if(Math.abs(d)<.5)return tgt; return cur+d*Math.min(1,dt/180); };
 b.dhpY=lerp(b.dhpY,Math.max(0,b.vhpY));
 b.dhpF=lerp(b.dhpF,Math.max(0,b.vhpF));
 if(b.shake>0)b.shake-=dt;
 if(b.banim)b.banim.t+=dt;
 if(b.phase==='msg'){
  // auto-avanza i nodi senza testo né animazione (solo effetti di stato)
  let guard=0;
  while(b.queue.length&&!b.queue[0].txt&&!b.queue[0].anim&&guard++<50){
   const c=b.queue.shift();
   if(!c.applied){ c.applied=true; if(c.fn)c.fn(); }
   if(c.after){ c.after(); return; }
   if(!battle)return;
   if(b.phase!=='msg')return;
  }
  const cur=b.queue[0];
  if(cur){
   if(!cur.applied){ cur.applied=true; if(cur.fn)cur.fn(); if(cur.anim)b.banim={type:cur.anim.type,dur:cur.anim.dur,t:0}; }
   const animDone=!cur.anim||(b.banim&&b.banim.t>=b.banim.dur);
   if(cur.anim&&animDone&&!cur.txt){
    b.queue.shift(); b.banim=null;
    if(cur.after){ cur.after(); }
    return;
   }
   if((ev==='A'||ev==='B')&&animDone){
    sfx('a'); b.queue.shift(); if(cur.anim)b.banim=null;
    if(cur.after)cur.after();
   }
  } else b.phase='menu';
  return;
 }
 if(b.phase==='menu'){
  if(ev==='U'&&b.menuSel>=2){b.menuSel-=2;sfx('menu');}
  else if(ev==='D'&&b.menuSel<2){b.menuSel+=2;sfx('menu');}
  else if(ev==='L'&&b.menuSel%2===1){b.menuSel--;sfx('menu');}
  else if(ev==='R'&&b.menuSel%2===0){b.menuSel++;sfx('menu');}
  else if(ev==='A'){
   sfx('a');
   if(b.menuSel===0)b.phase='fight';
   else if(b.menuSel===1){ menuState={kind:'bag',sel:0,ctx:'battle'}; GS.mode='menu'; }
   else if(b.menuSel===2){ menuState={kind:'party',sel:0,ctx:'switch'}; GS.mode='menu'; }
   else tryRun();
  }
  return;
 }
 if(b.phase==='fight'){
  const n=b.you.moves.length;
  if(ev==='U'&&b.fightSel>=2){b.fightSel-=2;sfx('menu');}
  else if(ev==='D'&&b.fightSel+2<n){b.fightSel+=2;sfx('menu');}
  else if(ev==='L'&&b.fightSel%2===1){b.fightSel--;sfx('menu');}
  else if(ev==='R'&&b.fightSel%2===0&&b.fightSel+1<n){b.fightSel++;sfx('menu');}
  else if(ev==='B'){b.phase='menu';sfx('b');}
  else if(ev==='A'){
   const mv=b.you.moves[b.fightSel];
   if(mv.pp<=0){ sfx('b'); return; }
   sfx('a');
   playTurn(mv);
  }
  return;
 }
}
function tryRun(){
 const b=battle;
 if(b.kind==='trainer'){ bq('Non puoi fuggire da una lotta tra allenatori!'); return; }
 const chance=Math.min(.95,.5+ (effSpe(b.you)-effSpe(b.foe))/200 + .2);
 if(R()<chance){ sfx('run'); bq('Fuga riuscita!', null, endBattleCleanup); }
 else { bq('Non riesci a fuggire!', null, ()=>{ foeTurnOnly(); }); }
}
function battleItemUsed(){ GS.mode='battle'; foeTurnOnly(); }
function doSwitch(idx){
 const b=battle;
 menuState=null; GS.mode='battle';
 if(b.forceSwitch){
  b.forceSwitch=false;
  b.you=GS.party[idx]; resetStages(b.you); b.dhpY=b.you.hp; b.vhpY=b.you.hp;
  bqa('Vai, '+SP(b.you.id).n+'!','sendY',400,()=>{ b.youDown=false; },()=>{ b.phase='menu'; });
 } else {
  bq(SP(b.you.id).n+', torna indietro!');
  b.you=GS.party[idx]; resetStages(b.you); b.dhpY=b.you.hp; b.vhpY=b.you.hp;
  bqa('Vai, '+SP(b.you.id).n+'!','sendY',400,()=>{ b.youDown=false; });
  foeTurnOnly();
 }
}
function foeTurnOnly(){
 const b=battle;
 const fm=pickFoeMove();
 execMove(b.foe,b.you,fm,false);
 endTurnStatus();
}
function pickFoeMove(){
 const b=battle;
 const usable=b.foe.moves.filter(m=>m.pp>0);
 if(usable.length===0)return {k:'azione',pp:1,struggle:true};
 // piccola IA: preferisci mosse efficaci
 let best=null,bestScore=-1;
 for(const m of usable){
  const mo=MOVES[m.k];
  let s=R()*20;
  if(mo.p>0)s+=mo.p*typeMult(mo.t,SP(b.you.id).t);
  else s+= b.you.status?0:25;
  if(s>bestScore){bestScore=s;best=m;}
 }
 return best;
}
function playTurn(yourMv){
 const b=battle;
 const foeMv=pickFoeMove();
 const yPr=MOVES[yourMv.k].pr||0, fPr=MOVES[foeMv.k].pr||0;
 let youFirst;
 if(yPr!==fPr)youFirst=yPr>fPr;
 else if(effSpe(b.you)!==effSpe(b.foe))youFirst=effSpe(b.you)>effSpe(b.foe);
 else youFirst=R()<.5;
 if(youFirst){
  execMove(b.you,b.foe,yourMv,true);
  execMoveIfAlive(b.foe,b.you,foeMv,false);
 } else {
  execMove(b.foe,b.you,foeMv,false);
  execMoveIfAlive(b.you,b.foe,yourMv,true);
 }
 endTurnStatus();
}
function execMoveIfAlive(user,tgt,mv,isYou){
 if(user.hp>0&&tgt.hp>0)execMove(user,tgt,mv,isYou);
}
// aggiorna la barra PS "visiva" del lato giusto quando il messaggio scorre
function visHp(m){
 const b=battle, v=Math.max(0,m.hp);
 const isYou=(m===b.you)||GS.party.includes(m);
 bqv(()=>{ if(!battle)return; if(isYou)b.vhpY=v; else if(m===b.foe)b.vhpF=v; });
}
function bqv(fn){ battle.queue.push({txt:null, fn, applied:false}); }
function execMove(user,tgt,mv,isYou){
 const b=battle, mo=MOVES[mv.k], un=SP(user.id).n, tn=SP(tgt.id).n;
 const tag=isYou?'':'Il nemico ';
 // stati che bloccano
 if(user.status==='SLP'){
  if(user.slpTurns>0){ user.slpTurns--; bq(tag+un+' sta dormendo...'); return; }
  user.status=null; bq(tag+un+' si sveglia!');
 }
 if(user.status==='FRZ'){
  if(R()<.2){ user.status=null; bq(tag+un+' si scongela!'); }
  else { bq(tag+un+' è congelato e non si muove!'); return; }
 }
 if(user.status==='PAR'&&R()<.25){ bq(tag+un+' è paralizzato! Non si muove!'); return; }
 mv.pp=Math.max(0,mv.pp-1);
 bq(tag+un+' usa '+mo.n+'!');
 bqanim(isYou?'lungeY':'lungeF',240);
 // precisione
 if(mo.a>0&&R()*100>mo.a){ bq('...ma fallisce!'); return; }
 if(mo.p>0){
  const hits=mo.hits||1;
  let landed=0;
  for(let h=0;h<hits;h++){
   if(tgt.hp<=0)break;
   const eff=typeMult(mo.t,SP(tgt.id).t);
   if(eff===0){ bq('Non ha alcun effetto su '+tn+'...'); break; }
   const crit=R()<(mo.hc?1/8:1/16);
   const stab=SP(user.id).t.includes(mo.t)?1.5:1;
   let dmg=Math.floor(Math.floor((2*user.lv/5+2)*mo.p*effAtk(user)/Math.max(1,effDef(tgt))/50)+2);
   dmg=Math.floor(dmg*stab*eff*(crit?2:1)*(217+Math.floor(R()*39))/255);
   dmg=Math.max(1,dmg);
   const applied=Math.min(tgt.hp,dmg);
   tgt.hp-=applied; landed++;
   const effSnap=eff;
   bqv(()=>{ battle.shake=250; battle.shakeTgt=isYou?'foe':'you'; sfx(effSnap>1?'super':'hit'); });
   visHp(tgt);
   if(crit)bq('Colpo critico!');
   if(eff>1)bq('È superefficace!');
   else if(eff<1)bq('Non è molto efficace...');
   if(mo.drain&&applied>0){
    const rec=Math.max(1,Math.floor(applied*mo.drain));
    user.hp=Math.min(user.maxhp,user.hp+rec);
    bq(un+' assorbe energia!'); visHp(user);
   }
  }
  if(hits>1&&landed>1)bq('Colpito '+landed+' volte!');
  // effetto secondario
  if(mo.fx&&tgt.hp>0&&mo.fx.st&&R()<(mo.fx.ch||1)&&!tgt.status){
   applyStatus(tgt,mo.fx.st,!isYou);
  }
  if(mo.fx&&tgt.hp>0&&mo.fx.stat&&mo.fx.tgt==='foe'&&R()<(mo.fx.ch||1)){
   applyStage(tgt,mo.fx.stat,mo.fx.d,!isYou);
  }
 } else {
  // mossa di stato
  if(mo.fx&&mo.fx.heal){
   user.hp=Math.min(user.maxhp,user.hp+Math.floor(user.maxhp*mo.fx.heal));
   bq(un+' recupera energia!',()=>sfx('heal')); visHp(user);
  } else if(mo.fx&&mo.fx.st){
   if(tgt.status)bq('Ma '+tn+' ha già uno stato alterato!');
   else applyStatus(tgt,mo.fx.st,!isYou);
  } else if(mo.fx&&mo.fx.stat){
   const who=mo.fx.tgt==='self'?user:tgt;
   applyStage(who,mo.fx.stat,mo.fx.d,mo.fx.tgt==='self'?isYou:!isYou);
  }
 }
 // KO
 if(tgt.hp<=0)handleFaint(tgt,isYou);
}
const STAT_N={atk:'Attacco',def:'Difesa',spe:'Velocità'};
const ST_MSG={PSN:'è avvelenato!',PAR:'è paralizzato!',SLP:'si addormenta!',BRN:'è scottato!',FRZ:'è congelato!'};
function applyStatus(m,st,isFoe){
 m.status=st;
 if(st==='SLP')m.slpTurns=ri(1,3);
 bq((isFoe?'Il nemico ':'')+SP(m.id).n+' '+ST_MSG[st]);
}
function applyStage(m,stat,d,isYouSide){
 const cur=m.stages[stat];
 const nv=Math.max(-6,Math.min(6,cur+d));
 if(nv===cur){ bq('Ma non ha effetto!'); return; }
 m.stages[stat]=nv;
 const n=SP(m.id).n;
 bq(n+': '+STAT_N[stat]+(d>0?(d>1?' sale di molto!':' sale!'):' scende!'));
}
function endTurnStatus(){
 const b=battle; if(!b)return;
 for(const [m,isYou] of [[b.you,true],[b.foe,false]]){
  if(m.hp<=0)continue;
  if(m.status==='PSN'||m.status==='BRN'){
   const chip=Math.max(1,Math.floor(m.maxhp/(m.status==='PSN'?8:16)));
   m.hp=Math.max(0,m.hp-chip);
   bq((isYou?'':'Il nemico ')+SP(m.id).n+(m.status==='PSN'?' soffre per il veleno!':' soffre per la scottatura!'),()=>sfx('hit'));
   visHp(m);
   if(m.hp<=0)handleFaint(m,!isYou);
  }
 }
}
function handleFaint(m,wasTargetOfYou){
 const b=battle;
 if(m.faintQueued)return;
 m.faintQueued=true;
 const isFoeMon = (m===b.foe)|| (b.foeParty&&b.foeParty.includes(m));
 bqanim(isFoeMon?'faintF':'faintY',450,()=>sfx('faint'),()=>{ if(!battle)return; if(isFoeMon)battle.foeDown=true; else battle.youDown=true; });
 bq((isFoeMon?'Il nemico ':'')+SP(m.id).n+' è esausto!');
 if(isFoeMon)foeFainted(); else youFainted();
}
function foeFainted(){
 const b=battle;
 // esperienza
 const sp=SP(b.foe.id);
 const gain=Math.max(1,Math.floor(sp.bx*b.foe.lv/7*(b.kind==='trainer'?1.5:1)));
 const mon=b.you;
 mon.exp+=gain;
 bq(SP(mon.id).n+' guadagna '+gain+' Esp.!');
 checkLevelUps(mon);
 afterFoeFaint();
}
function checkLevelUps(mon){
 while(mon.lv<100&&mon.exp>=expForLv(mon.lv+1)){
  mon.lv++;
  recalcStats(mon);
  bq(SP(mon.id).n+' sale al livello '+mon.lv+'!',()=>sfx('lvl'));
  if(battle)visHp(mon);
  // nuove mosse
  const sp=SP(mon.id);
  for(const [lv,k] of sp.mv){
   if(lv===mon.lv&&!mon.moves.some(m=>m.k===k)){
    if(mon.moves.length<4){
     mon.moves.push({k,pp:MOVES[k].pp});
     bq(SP(mon.id).n+' impara '+MOVES[k].n+'!',()=>sfx('lvl'));
    } else {
     const kk=k;
     bq(SP(mon.id).n+' vorrebbe imparare '+MOVES[kk].n+', ma conosce già 4 mosse!',null,()=>{
      menuState={kind:'learn',mon,move:kk,sel:0,cb:()=>{ GS.mode='battle'; }};
      GS.mode='menu';
     });
    }
   }
  }
  if(sp.ev&&mon.lv>=sp.ev.lv&&battle&&!battle.pendingEvo.includes(mon))battle.pendingEvo.push(mon);
 }
}
function afterFoeFaint(){
 const b=battle;
 if(b.kind==='trainer'&&b.foeIdx<b.foeParty.length-1){
  b.foeIdx++;
  b.foe=b.foeParty[b.foeIdx];
  resetStages(b.foe);
  GS.dex.seen[b.foe.id]=1;
  bqa(b.trainer.name+' manda in campo '+SP(b.foe.id).n+'!','sendF',400,()=>{ b.dhpF=b.foe.hp; b.vhpF=b.foe.hp; b.foeDown=false; b.foeHidden=false; },()=>{ b.phase='menu'; });
 } else if(b.kind==='trainer'){
  // vittoria contro allenatore
  const tr=b.trainer;
  bq('Hai sconfitto '+tr.name+'!');
  bq(tr.name+': "'+tr.l+'"');
  bq('Ricevi '+tr.money+'¤!',()=>{ GS.money+=tr.money; GS.defeated[tr.id]=1; });
  if(tr.badge!==undefined){
   bq('Ottieni la '+tr.badgeName+'!',()=>{ if(!GS.badges.includes(tr.badge))GS.badges.push(tr.badge); sfx('badge'); });
  }
  if(tr.champion){
   bq('Congratulazioni! Sei il nuovo CAMPIONE DI VALMORA!',()=>{ GS.flags.champion=true; sfx('badge'); });
   bq('Il Prof. Cedro sarebbe fiero di te. Grazie per aver giocato!');
  }
  bq('',null,endBattleVictory);
 } else {
  bq('',null,endBattleVictory);
 }
}
function endBattleVictory(){
 const evos=battle.pendingEvo.slice();
 endBattleCleanup();
 runEvolutions(evos);
}
function runEvolutions(evos){
 if(evos.length===0)return;
 const mon=evos.shift();
 const sp=SP(mon.id);
 if(!sp.ev||mon.lv<sp.ev.lv){ runEvolutions(evos); return; }
 const to=SP(sp.ev.to);
 say('Che succede? '+sp.n+' si sta evolvendo!', ()=>{
  const ratio=mon.hp/mon.maxhp;
  mon.id=to.id; recalcStats(mon); mon.hp=Math.max(1,Math.floor(mon.maxhp*ratio));
  GS.dex.seen[to.id]=1; GS.dex.caught[to.id]=1;
  sfx('badge');
  say(sp.n+' si è evoluto in '+to.n+'!', ()=>runEvolutions(evos));
 });
}
function youFainted(){
 const b=battle;
 const alive=GS.party.filter(m=>m.hp>0).length;
 if(alive>0){
  bq('Scegli la prossima creatura!',null,()=>{
   b.forceSwitch=true;
   menuState={kind:'party',sel:0,ctx:'switch',force:true};
   GS.mode='menu';
  });
 } else {
  bq('Non hai più creature in grado di lottare!');
  bq('Torni di corsa al Centro Cure più vicino...',null,()=>{
   const lost=Math.floor(GS.money/2);
   GS.money-=lost;
   endBattleCleanup();
   const lh=GS.lastHeal||{map:'world',x:TOWNS[0].x,y:TOWNS[0].y+1};
   fadeOut(()=>{
    GS.map=lh.map; GS.px=lh.x; GS.py=lh.y; GS.dir=2;
    for(const m of GS.party){ m.hp=m.maxhp; m.status=null; for(const mv of m.moves)mv.pp=MOVES[mv.k].pp; }
    fadeIn();
    say('Le tue creature sono state curate. (Hai perso '+lost+'¤ per strada...)');
   });
  });
 }
}
function endBattleCleanup(){ battle=null; if(GS.mode==='battle')GS.mode='world'; }

function throwBall(k){
 const b=battle;
 menuState=null; GS.mode='battle';
 GS.bag[k]--;
 const it=ITEMS[k];
 bq('Lanci una '+it.n+'!');
 const m=b.foe, sp=SP(m.id);
 let f=(3*m.maxhp-2*m.hp)*sp.cr*it.ball/(3*m.maxhp);
 if(m.status==='SLP'||m.status==='FRZ')f*=2;
 else if(m.status)f*=1.5;
 const p=Math.min(1,f/255);
 let shakes=0;
 for(let i=0;i<3;i++){ if(R()<Math.pow(p,1/3))shakes++; }
 const caught = shakes===3 && R()<p;
 bqanim('throw',450,()=>sfx('run'));
 bqanim('absorb',350,()=>sfx('menu'),()=>{ if(battle)battle.foeHidden=true; });
 bqanim('drop',300,()=>sfx('hit'));
 const nsh=caught?3:Math.max(1,shakes);
 for(let i=0;i<nsh;i++)bqanim('shakeBall',450,()=>sfx('menu'));
 if(caught){
  const wasFull=GS.party.length>=6;
  GS.dex.caught[m.id]=1; GS.dex.seen[m.id]=1;
  m.stages={atk:0,def:0,spe:0}; m.faintQueued=false;
  if(!wasFull)GS.party.push(m); else GS.box.push(m);
  bqanim('caught',700,()=>{ if(battle)battle.ballRest=true; sfx('catch'); });
  bq(sp.n+' è stato catturato!');
  if(wasFull)bq('La squadra è piena: '+sp.n+' è stato inviato al BOX del PC.');
  bq('I dati di '+sp.n+' sono stati registrati nel VALDEX!');
  bq('',null,endBattleCleanup);
 } else {
  bqanim('burst',350,()=>{ if(battle)battle.foeHidden=false; sfx('super'); });
  const msgs=['Oh no! La creatura si è liberata!','Accidenti! C\'era quasi!','Argh! Si dimena troppo!'];
  bq(shakes===0?msgs[0]:msgs[Math.min(2,shakes)]);
  bq('',null,()=>{ foeTurnOnly(); });
 }
}

// ---------- disegno battaglia ----------
function drawBattle(){
 const b=battle; if(!b)return;
 // sfondo
 const grad=ctx.createLinearGradient(0,0,0,VH);
 grad.addColorStop(0,'#a8d8f0'); grad.addColorStop(.55,'#c8e8c0'); grad.addColorStop(.56,'#90c878'); grad.addColorStop(1,'#78b860');
 ctx.fillStyle=grad; ctx.fillRect(0,0,VW,VH);
 // piattaforme
 ctx.fillStyle='#88b868'; ctx.beginPath(); ctx.ellipse(350,132,80,20,0,0,7); ctx.fill();
 ctx.fillStyle='#78a858'; ctx.beginPath(); ctx.ellipse(120,235,90,24,0,0,7); ctx.fill();
 const sh=b.shake>0? (R()*6-3):0;
 // trasformazioni dalle animazioni in corso
 let fx=294,fy=26,fw=112,fh=112,fa=1;
 let yx=48,yy=106,yw=152,yh=152,ya=1;
 if(b.shake>0){ if(b.shakeTgt==='you')yx+=sh; else { fx+=sh; fy+=(R()*4-2); } }
 let ball=null, burst=0, stars=0;
 const A=b.banim;
 if(A){
  const p=Math.max(0,Math.min(1,A.t/A.dur));
  const s1=Math.sin(p*Math.PI);
  if(A.type==='lungeY'){ yx+=s1*20; yy-=s1*8; }
  else if(A.type==='lungeF'){ fx-=s1*16; fy+=s1*8; }
  else if(A.type==='faintF'){ fy+=p*70; fa=1-p; }
  else if(A.type==='faintY'){ yy+=p*70; ya=1-p; }
  else if(A.type==='sendY'){ const s=.3+.7*p; yw*=s; yh*=s; yx+=(152-yw)/2; yy+=152-yh; ya=Math.min(1,p*4); }
  else if(A.type==='sendF'){ const s=.3+.7*p; fw*=s; fh*=s; fx+=(112-fw)/2; fy+=112-fh; fa=Math.min(1,p*4); }
  else if(A.type==='throw'){ ball={x:150+200*p, y:225-141*p-s1*70, tilt:p*9}; }
  else if(A.type==='absorb'){ ball={x:350,y:82}; const s=1-p; fw*=s; fh*=s; fx=350-fw/2; fy=88-fh/2; }
  else if(A.type==='drop'){ ball={x:350,y:82+40*p}; }
  else if(A.type==='shakeBall'){ ball={x:350,y:122,tilt:Math.sin(p*Math.PI*4)*0.5}; }
  else if(A.type==='caught'){ ball={x:350,y:122}; stars=p; }
  else if(A.type==='burst'){ burst=p; fw*=p; fh*=p; fx=350-fw/2; fy=82-fh/2; }
 }
 if(b.ballRest&&!ball)ball={x:350,y:122};
 const blink=b.shake>0&&Math.floor(GS.anim/70)%2===0;
 // nemico (fronte)
 const fshow=!(b.foeDown||b.foeHidden)&&(b.foe.hp>0||b.dhpF>0.5||A);
 if(fshow&&!(blink&&b.shakeTgt==='foe')){ ctx.globalAlpha=fa; drawMon(ctx,b.foe.id,fx,fy,fw,fh); ctx.globalAlpha=1; }
 // tuo (retro)
 const yshow=!b.youDown&&(b.you.hp>0||b.dhpY>0.5||A);
 if(yshow&&!(blink&&b.shakeTgt==='you')){ ctx.globalAlpha=ya; drawMonBack(ctx,b.you.id,yx,yy,yw,yh); ctx.globalAlpha=1; }
 // effetti: lampo di apertura, sfera, stelline
 if(burst>0){ ctx.globalAlpha=1-burst; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(350,105,20+burst*70,0,7); ctx.fill(); ctx.globalAlpha=1; }
 if(ball)drawBall(ctx,ball.x,ball.y,12,ball.tilt||0);
 if(stars>0){ ctx.globalAlpha=Math.min(1,stars*1.5); ctx.fillStyle='#f8d030'; ctx.font='bold '+(12+stars*6)+'px monospace'; ctx.textBaseline='top';
  ctx.fillText('★',322,104-stars*26); ctx.fillText('★',346,96-stars*32); ctx.fillText('★',372,104-stars*26); ctx.globalAlpha=1; }
 // box info nemico
 box(14,14,190,58);
 txt(SP(b.foe.id).n,24,22,'#303030',13);
 txt('L'+b.foe.lv,160,22,'#303030',12);
 const fmon={hp:b.dhpF,maxhp:b.foe.maxhp};
 hpBar(24,42,150,fmon);
 statusTag(b.foe,24,54);
 // box info tuo
 box(VW-210,VH-146,196,70);
 txt(SP(b.you.id).n,VW-198,VH-138,'#303030',13);
 txt('L'+b.you.lv,VW-50,VH-138,'#303030',12);
 const ymon={hp:b.dhpY,maxhp:b.you.maxhp};
 hpBar(VW-198,VH-118,150,ymon);
 txt(Math.ceil(Math.max(0,b.dhpY))+'/'+b.you.maxhp,VW-198,VH-104,'#303030',11);
 statusTag(b.you,VW-90,VH-106);
 // barra esperienza
 const need=expForLv(b.you.lv+1)-expForLv(b.you.lv);
 const have=b.you.exp-expForLv(b.you.lv);
 ctx.fillStyle='#585858'; ctx.fillRect(VW-198,VH-88,150,5);
 ctx.fillStyle='#40a0f8'; ctx.fillRect(VW-197,VH-87,148*Math.max(0,Math.min(1,have/need)),3);
 // riquadro messaggi/menu
 box(8,VH-72,VW-16,64,{bg:'#283848'});
 if(b.phase==='msg'){
  const cur=b.queue[0];
  if(cur&&cur.txt){
   const lines=wrapText(cur.txt,52);
   let y=VH-60;
   for(const l of lines.slice(0,3)){ txt(l,20,y,'#f8f8f8'); y+=17; }
   if(Math.floor(GS.anim/400)%2)txt('▼',VW-34,VH-24,'#f8d030');
  }
 } else if(b.phase==='menu'){
  txt('Cosa deve fare',20,VH-60,'#f8f8f8');
  txt(SP(b.you.id).n+'?',20,VH-42,'#f8f8f8');
  const opts=['LOTTA','ZAINO','SQUADRA','FUGA'];
  ctx.fillStyle='#f8f8e8'; ctx.fillRect(VW-200,VH-68,188,56);
  ctx.strokeStyle='#385890'; ctx.strokeRect(VW-200,VH-68,188,56);
  opts.forEach((o,i)=>{
   const x=VW-190+(i%2)*95, y=VH-60+Math.floor(i/2)*26;
   if(b.menuSel===i)txt('▶',x-10,y,'#c03028');
   txt(o,x+2,y,'#303030',12);
  });
 } else if(b.phase==='fight'){
  ctx.fillStyle='#f8f8e8'; ctx.fillRect(12,VH-68,VW-24,56);
  ctx.strokeStyle='#385890'; ctx.strokeRect(12,VH-68,VW-24,56);
  b.you.moves.forEach((mv,i)=>{
   const x=28+(i%2)*230, y=VH-58+Math.floor(i/2)*26;
   if(b.fightSel===i)txt('▶',x-14,y,'#c03028');
   const mo=MOVES[mv.k];
   txt(mo.n,x,y,mv.pp>0?'#303030':'#a0a0a0',12);
   txt('PP'+mv.pp,x+140,y,'#606060',10);
   ctx.fillStyle=TYPES[mo.t].c; ctx.fillRect(x+178,y,36,12);
   txt(TYPES[mo.t].n.slice(0,4),x+180,y+1,'#fff',9);
  });
 }
}
// ================================================================
// PARTE 7 — Titolo, salvataggio, avvio
// ================================================================
let titleSel=0, hasSave=false;
function drawTitle(){
 const grad=ctx.createLinearGradient(0,0,0,VH);
 grad.addColorStop(0,'#183058'); grad.addColorStop(1,'#38689a');
 ctx.fillStyle=grad; ctx.fillRect(0,0,VW,VH);
 // stelle
 const rng=mulberry32(7);
 ctx.fillStyle='#c8e0f8';
 for(let i=0;i<60;i++)ctx.fillRect(Math.floor(rng()*VW),Math.floor(rng()*VH*.5),2,2);
 // logo
 ctx.textBaseline='top';
 ctx.font='bold 56px monospace';
 ctx.fillStyle='#0a1830'; ctx.fillText('VALMORA',102,64);
 ctx.fillStyle='#f8d030'; ctx.fillText('VALMORA',98,60);
 ctx.font='bold 16px monospace';
 ctx.fillStyle='#c8e0f8'; ctx.fillText('Leggende della Regione Smeralda',96,130);
 // creature decorative
 drawMon(ctx,6,30,180,80,80);
 drawMon(ctx,9,370,180,80,80);
 drawMon(ctx,54,196,152,88,88);
 if(hasSave){
  ['NUOVA PARTITA','CONTINUA'].forEach((s,i)=>{
   ctx.fillStyle= titleSel===i? '#f8d030':'#c8e0f8';
   ctx.font='bold 18px monospace';
   ctx.fillText((titleSel===i?'▶ ':'  ')+s,170,240+i*28);
  });
 } else {
  if(Math.floor(GS.anim/500)%2){ ctx.fillStyle='#f8f8f8'; ctx.font='bold 18px monospace'; ctx.fillText('Premi Z per iniziare',140,250); }
 }
 ctx.fillStyle='#88a8c8'; ctx.font='11px monospace';
 ctx.fillText('Frecce/WASD: muovi   Z/Spazio: A   X/Esc: B   Invio: menu   M: audio',24,VH-18);
}
function titleAction(){
 sfx('a');
 if(hasSave&&titleSel===1){ if(loadGame()){ GS.mode='world'; fadeIn(); return; } }
 newGame();
}
function newGame(){
 GS.mode='world'; GS.map='world';
 GS.px=TOWNS[0].x; GS.py=TOWNS[0].y+1; GS.dir=2;
 GS.party=[]; GS.box=[]; GS.bag={sfera:5,pozione:3}; GS.money=3000;
 GS.badges=[]; GS.defeated={}; GS.flags={}; GS.dex={seen:{},caught:{}};
 GS.lastHeal={map:'world',x:TOWNS[0].x,y:TOWNS[0].y+1};
 say('Benvenuto nella regione di VALMORA! Il laboratorio del Prof. Cedro è l\'edificio col tetto viola, qui a sud. Va\' a trovarlo: ha un regalo per te!');
}
const SAVE_KEY='valmora_save_v1';
function saveData(){
 return JSON.stringify({
  map:GS.map,px:GS.px,py:GS.py,dir:GS.dir,party:GS.party,box:GS.box,bag:GS.bag,
  money:GS.money,badges:GS.badges,defeated:GS.defeated,flags:GS.flags,dex:GS.dex,
  lastHeal:GS.lastHeal,name:GS.name,steps:GS.steps
 });
}
function saveGame(){
 try{ localStorage.setItem(SAVE_KEY,saveData()); hasSave=true; }catch(e){}
}
function applySave(d){
 GS.map=d.map;GS.px=d.px;GS.py=d.py;GS.dir=d.dir||2;
 GS.party=d.party||[];GS.box=d.box||[];GS.bag=d.bag||{};GS.money=d.money||0;
 GS.badges=d.badges||[];GS.defeated=d.defeated||{};GS.flags=d.flags||{};
 GS.dex=d.dex||{seen:{},caught:{}};GS.lastHeal=d.lastHeal;GS.name=d.name||'ALEX';GS.steps=d.steps||0;
 GS.moving=false; battle=null; menuState=null; dialogQ=null;
 // ricalcola i derivati per sicurezza
 for(const m of [...GS.party,...GS.box]){ const hp=m.hp; recalcStats(m); m.hp=Math.min(hp,m.maxhp); }
 // nasconde la guardia se già superata
 if(GS.badges.length>=8){ const g=MAPS.world.npcs.find(n=>n.guard); if(g&&GS.flags.guardGone)g.hidden=true; }
}
function loadGame(){
 try{
  const s=localStorage.getItem(SAVE_KEY);
  if(!s)return false;
  applySave(JSON.parse(s));
  return true;
 }catch(e){ return false; }
}
function exportSave(){
 const blob=new Blob([saveData()],{type:'application/json'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob); a.download='valmora_salvataggio.json'; a.click();
}
function importSave(file){
 const r=new FileReader();
 r.onload=()=>{ try{ applySave(JSON.parse(r.result)); GS.mode='world'; saveGame(); say('Salvataggio importato con successo!'); }catch(e){ alert('File di salvataggio non valido.'); } };
 r.readAsText(file);
}

function init(){
 buildWorld();
 cv=document.getElementById('gioco');
 ctx=cv.getContext('2d');
 preloadSprites();
 initInput();
 try{ hasSave=!!localStorage.getItem(SAVE_KEY); }catch(e){}
 addEventListener('keydown',e=>{
  if(GS.mode==='title'&&hasSave){
   if(e.key==='ArrowUp'||e.key==='ArrowDown'||e.key.toLowerCase()==='w'||e.key.toLowerCase()==='s'){ titleSel=1-titleSel; sfx('menu'); }
  }
 });
 const be=document.getElementById('btn-export'), bi=document.getElementById('btn-import'), fi=document.getElementById('file-import');
 if(be)be.onclick=exportSave;
 if(bi)bi.onclick=()=>fi.click();
 if(fi)fi.onchange=()=>{ if(fi.files[0])importSave(fi.files[0]); fi.value=''; };
 requestAnimationFrame(loop);
}

// ---------- test automatico dei dati (eseguito con Node) ----------
function selfTest(){
 const errs=[];
 for(const sp of DEX){
  for(const [lv,k] of sp.mv){ if(!MOVES[k])errs.push(sp.n+': mossa inesistente '+k); if(lv<1||lv>100)errs.push(sp.n+': livello mossa errato'); }
  if(sp.ev&&!DEX[sp.ev.to-1])errs.push(sp.n+': evoluzione inesistente');
  if(sp.ev&&sp.ev.to===sp.id)errs.push(sp.n+': si evolve in sé stesso');
  if(!sp.mv.some(([lv,k])=>lv===1&&MOVES[k]&&MOVES[k].p>0))errs.push(sp.n+': nessuna mossa offensiva al liv.1');
  for(const t of sp.t)if(!TYPES[t])errs.push(sp.n+': tipo inesistente '+t);
  if(sp.bs.length!==4)errs.push(sp.n+': statistiche mancanti');
 }
 const checkParty=(who,party)=>{ for(const [id,lv] of party){ if(!DEX[id-1])errs.push(who+': specie inesistente '+id); if(lv<1||lv>100)errs.push(who+': livello errato'); } };
 TOWNS.forEach((t,i)=>{ if(t.gym)checkParty('Palestra '+t.n,t.gym.party); });
 ROUTE_TRAINERS.forEach((rt,i)=>rt.forEach(tr=>checkParty('Percorso '+i+' '+tr.name,tr.party)));
 GYM_TRAINERS.forEach((g,i)=>{ if(g)checkParty('GymTrainer '+i,g.party); });
 ELITE.forEach(e=>checkParty(e.name,e.party));
 checkParty('Campionessa',CHAMPION.party);
 ROUTE_POOLS.forEach((p,i)=>p.pool.forEach(([id])=>{ if(!DEX[id-1])errs.push('Pool percorso '+i+': specie '+id); }));
 for(const t in CHART)for(const d in CHART[t]){ if(!TYPES[t]||!TYPES[d])errs.push('Tabella tipi: '+t+'->'+d); }
 for(const k in ITEMS){ const it=ITEMS[k]; if(!it.n||!it.buy)errs.push('Oggetto incompleto: '+k); }
 for(const sp of DEX){ if(!SPRITE_IDS[sp.id])errs.push('Sprite mancante per '+sp.n); }
 // simulazione: crea ogni specie a vari livelli
 for(const sp of DEX){ for(const lv of [5,20,50]){ const m=mkMon(sp.id,lv); if(m.moves.length<1)errs.push(sp.n+' L'+lv+': senza mosse'); if(m.maxhp<=0)errs.push(sp.n+': PS non validi'); } }
 // simulazione di danno
 const a=mkMon(1,10),b2=mkMon(4,10);
 if(typeMult('ACQ',['FUO'])!==2||typeMult('ELE',['TER'])!==0)errs.push('Tabella tipi errata');
 return errs;
}
if(typeof window==='undefined'){
 const errs=selfTest();
 // verifica generazione mondo simulando il DOM minimo necessario? no: buildWorld non usa il DOM
 try{ buildWorld();
  const w=MAPS.world;
  // ogni porta deve avere un warp e ogni warp una destinazione valida
  for(const key in w.warps){ const wp=w.warps[key]; if(!MAPS[wp.map])errs.push('Warp verso mappa inesistente: '+wp.map); }
  for(const id in MAPS){ const m=MAPS[id]; for(const key in m.warps){ const wp=m.warps[key]; if(!MAPS[wp.map])errs.push('Warp rotto in '+id); else { const [x,y]=key.split(',').map(Number); const t=G(m,x,y); if(t!==8&&t!==12)errs.push('Warp su tile non-porta in '+id+' @'+key+' (tile '+t+')'); } } }
  // destinazioni dei warp raggiungibili (non solide)
  for(const id in MAPS){ const m=MAPS[id]; for(const key in m.warps){ const wp=m.warps[key]; const t=G(MAPS[wp.map],wp.x,wp.y); if(SOLID.has(t))errs.push('Destinazione warp solida: '+id+' -> '+wp.map+' @'+wp.x+','+wp.y+' (tile '+t+')'); } }
  // npc su tile non solidi
  for(const id in MAPS){ for(const n of MAPS[id].npcs){ const t=G(MAPS[id],n.x,n.y); if(SOLID.has(t))errs.push('NPC su tile solido in '+id+' @'+n.x+','+n.y+' (tile '+t+')'); } }
  // l'altare esiste
  let altareOk=false; for(let i=0;i<w.t.length;i++)if(w.t[i]===20)altareOk=true;
  if(!altareOk)errs.push('Altare di Solverio mancante');
 }catch(e){ errs.push('buildWorld: '+e.message+'\n'+e.stack); }
 if(errs.length){ console.log('ERRORI ('+errs.length+'):'); for(const e of errs)console.log(' - '+e); process.exit(1); }
 console.log('Tutti i controlli superati: '+DEX.length+' specie, '+Object.keys(MOVES).length+' mosse, '+Object.keys(MAPS).length+' mappe.');
} else {
 addEventListener('load',init);
}
// fine
