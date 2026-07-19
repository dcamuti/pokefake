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
 morso:{n:'Morso',t:'NOR',p:60,a:100,pp:25,fl:.3},
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
 fangata:{n:'Fangata',t:'TER',p:55,a:100,pp:15,fx:{stat:'acc',d:-1,tgt:'foe',ch:1}},
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
 psicoraggio:{n:'Psicoraggio',t:'PSI',p:65,a:100,pp:20,fx:{cf:.15}},
 psichico:{n:'Psichico',t:'PSI',p:90,a:100,pp:10,fx:{stat:'spd',d:-1,tgt:'foe',ch:.1}},
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
const DEXTXT={
1:'Germoglia sul dorso una foglia che profuma di rugiada.',2:'Le radici sulle zampe gli danno presa su ogni roccia.',3:'Il suo guscio fiorito ospita interi sciami di insetti amici.',
4:'La sua coda scalda le tane nelle notti fredde.',5:'Sputa braci quando è agitato: meglio non spaventarlo.',6:'Le sue ali sollevano correnti d\'aria rovente.',
7:'Soffia bolle che riflettono l\'arcobaleno.',8:'Nuota controcorrente per allenare le pinne.',9:'Con un pugno d\'acqua compressa buca la roccia.',
10:'Rosicchia qualsiasi cosa per limare i denti che crescono sempre.',11:'Fa scorte di bacche che poi dimentica ovunque.',12:'Canta all\'alba per segnare il territorio.',
13:'Plana tra i tetti a caccia di insetti.',14:'Le sue ali tagliano il vento senza alcun rumore.',15:'Fila una seta resistente come l\'acciaio.',
16:'Nel bozzolo sogna la forma che avrà.',17:'Le sue ali spargono una polvere che fa starnutire.',18:'Cresce all\'ombra e sparge spore soporifere.',
19:'Il suo cappello contiene un veleno usato in medicina.',20:'Accumula elettricità statica strofinandosi al pelo.',21:'Quando sfreccia lascia scie luminose.',
22:'I suoi fulmini illuminano le notti di Voltacittà.',23:'Dorme per anni fingendosi un masso qualunque.',24:'Rotola a valle per spostarsi: attenzione ai piedi.',
25:'Scava gallerie che crollano dietro di lui.',26:'Sente i terremoti con giorni di anticipo.',27:'Saluta i pescherecci saltando fuori dall\'acqua.',
28:'Guida i banchi di pesci con fischi ultrasonici.',29:'Appare negli specchi appannati dei Centri Cure.',30:'Colleziona i sospiri di chi si spaventa.',
31:'Si dice abiti i sogni lasciati a metà.',32:'Legge i pensieri ma li dimentica subito.',33:'Piega i cucchiai di tutta Mentevilla quando si annoia.',
34:'Si allena colpendo le cascate controcorrente.',35:'Con un pugno può spostare un vagone merci.',36:'Vive nei fossi e mastica rifiuti che rende innocui.',
37:'Il suo morso lascia un veleno che paralizza lentamente.',38:'Il suo fiato gela le pozzanghere in un istante.',39:'Scolpisce il ghiaccio con gli artigli per divertimento.',
40:'Ruba il miele con la faccia più innocente del mondo.',41:'Quando si alza sulle zampe posteriori è il doppio di te.',42:'Dorme appeso ai lampioni scambiandoli per rami.',
43:'Sente il battito delle prede a cento passi.',44:'Cola lava dal dorso: non abbracciarlo mai.',45:'La sua corazza è forgiata nel magma di Dragospoli.',
46:'Nasce tra le rupi e mastica ghiaia per rinforzare le zanne.',47:'La sua corazza respinge le lance dei cacciatori antichi.',48:'Signore dei cieli di Dragospoli: pochi lo hanno visto atterrare.',
49:'Genera corrente nuotando in cerchio nei laghi.',50:'Un idolo di pietra animato da una mente antica.',51:'Nebbia che canta: chi la segue si perde.',
52:'La sua criniera si gonfia quando fiuta una sfida.',53:'Coltiva alghe rare sul proprio guscio.',54:'Il custode di Valmora: si mostra solo a chi ha un cuore saldo.'
};
// Att./Dif. Speciali per specie (stile Gen III): bs diventa [ps,att,dif,atsp,dfsp,vel]
const SPX={1:[45,55],2:[62,70],3:[85,90],4:[60,45],5:[80,60],6:[105,80],7:[50,50],8:[65,70],9:[85,95],
10:[25,35],11:[50,60],12:[30,35],13:[45,50],14:[65,70],15:[20,25],16:[25,45],17:[80,70],18:[60,55],19:[85,75],
20:[60,40],21:[85,55],22:[115,70],23:[30,40],24:[45,60],25:[35,45],26:[50,65],27:[55,50],28:[85,75],
29:[60,40],30:[90,60],31:[120,80],32:[75,40],33:[120,70],34:[25,45],35:[40,70],36:[40,50],37:[60,75],
38:[55,50],39:[85,80],40:[30,40],41:[50,65],42:[40,40],43:[70,70],44:[55,45],45:[80,70],46:[50,45],47:[70,65],48:[100,90],
49:[80,85],50:[65,90],51:[85,75],52:[55,60],53:[75,85],54:[120,110]};
for(const sp of DEX){ const q=SPX[sp.id]; sp.bs=[sp.bs[0],sp.bs[1],sp.bs[2],q[0],q[1],sp.bs[3]]; }
const SPECIAL_TYPES=new Set(['FUO','ACQ','ERB','ELE','PSI','GHI','DRA']);
const ABIL={};
const ABIL_SET=[[[1,2,3],'Erbaiuto'],[[4,5,6],'Aiutofuoco'],[[7,8,9],'Idroaiuto'],
 [[10,11,25,26],'Fugafacile'],[[12,13,14,17,32,33,42,43],'Insonnia'],[[15,16,23,24,50],'Robustezza'],
 [[18,19,36,37],'Velenopunto'],[[20,21,22],'Statico'],[[27,28],'Nuotovelox'],
 [[29,30,31,51],'Levitazione'],[[34,35,40,41,46,47,48,52],'Intimidazione'],
 [[44,45],'Corpodifuoco'],[[49],'Assorbivolt'],[[53],'Assorbacqua'],[[38,39],'Mantelneve'],[[54],'Aura del Custode']];
for(const q of ABIL_SET)for(const i of q[0])ABIL[i]=q[1];
const ABIL_D={Erbaiuto:'Con pochi PS potenzia le mosse Erba.',Aiutofuoco:'Con pochi PS potenzia le mosse Fuoco.',
 Idroaiuto:'Con pochi PS potenzia le mosse Acqua.',Fugafacile:'Fuga garantita dalle lotte selvatiche.',
 Insonnia:'Impedisce il sonno.',Robustezza:'A PS pieni resiste a un colpo da KO.',
 Velenopunto:'Può avvelenare chi lo colpisce da vicino.',Statico:'Può paralizzare chi lo colpisce da vicino.',
 Nuotovelox:'Raddoppia la Velocità sotto la pioggia.',Levitazione:'Immune alle mosse Terra.',
 Intimidazione:'Abbassa l\'Attacco del nemico all\'entrata.',Corpodifuoco:'Può scottare chi lo colpisce da vicino.',
 Assorbivolt:'Assorbe le mosse Elettro e recupera PS.',Assorbacqua:'Assorbe le mosse Acqua e recupera PS.',
 Mantelneve:'A suo agio nella grandine.','Aura del Custode':'Presenza leggendaria.'};
const HOLD_BOOST={carbone:'FUO',gocciamistica:'ACQ',fogliamagica:'ERB',magnete:'ELE'};

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
 revitalizzante:{n:'Revitalizzante', revive:.5, buy:1500, d:'Rianima una creatura KO.'},
 baccaoran:{n:'Baccaoran', hold:1, buy:150, d:'Da tenere: cura 15 PS quando i PS scendono a metà.'},
 baccacura:{n:'Baccacura', hold:1, buy:300, d:'Da tenere: cura automaticamente gli stati alterati.'},
 carbone:{n:'Carbone', hold:1, buy:1000, d:'Da tenere: potenzia le mosse Fuoco del 10%.'},
 gocciamistica:{n:'Goccia Mistica', hold:1, buy:1000, d:'Da tenere: potenzia le mosse Acqua del 10%.'},
 fogliamagica:{n:'Foglia Magica', hold:1, buy:1000, d:'Da tenere: potenzia le mosse Erba del 10%.'},
 magnete:{n:'Magnete', hold:1, buy:1000, d:'Da tenere: potenzia le mosse Elettro del 10%.'},
 fasciafocus:{n:'Fascia Focus', hold:1, buy:2500, d:'Da tenere: 10% di resistere a 1 PS a un colpo da KO.'},
 canna:{n:'Canna da Pesca', buy:500, tool:'fish', d:'Usala rivolto verso l\'acqua per pescare creature.'}
};

// ================================================================
// PARTE 2 — Regione di Valmora: città, percorsi, allenatori
// ================================================================
const WORLD_W=256, WORLD_H=256, TILE=16;
// tile: 0 erba,1 erba alta,2 albero,3 sentiero,4 fiori,5 acqua,6 staccionata,7 cartello,
// 8 porta,9 muro,11 finestra,12 tappeto uscita,13 pavimento,14 tappeto,15 bancone,16 macchina cure,
// 17 PC,18 libreria,19 statua,30-34 tetti (centro,market,palestra,casa,lab/lega), 20 altare
const SOLID = new Set([2,5,6,7,9,11,15,16,17,18,19,30,31,32,33,34,20,25,21]);

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
 [{f:.35, name:'Asso Marco', cls:'asso', double:true, party:[[13,36],[21,36],[45,37]], t:'Solo i migliori percorrono la Via della Lega! Io lotto in coppia!', l:'Sei pronto per la Lega.'},
  {f:.7, name:'Asso Lia', cls:'asso', double:true, party:[[28,37],[43,37],[47,38]], t:'Ultimo ostacolo prima della Lega: io e la mia coppia!', l:'La Lega ti attende, campione.'}]
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
function newMap(id,w,h,fill){ const m={id,w,h,t:new Uint8Array(w*h).fill(fill),warps:{},npcs:[],signs:{},bldgs:[]}; MAPS[id]=m; return m; }

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
   if(edge){
    if(cur===5)T(m,x,y,0);
    else if(cur===2&&rng()<.5)T(m,x,y,0);
   } else if(cur!==3){
    T(m,x,y,0);
    ZONE[y*WORLD_W+x]=ridx+1;
   }
  }
  T(m,px,py,3); // sentiero centrale
 }
 // sporgenze saltabili sotto i tratti orizzontali
 for(let i=6;i<pts.length-8;i++){
  const p0=pts[i], p1=pts[i+1];
  if(p1[1]===p0[1]&&Math.abs(p1[0]-p0[0])===1&&rng()<.09){
   const len=3+Math.floor(rng()*3);
   for(let k=0;k<len&&i+k<pts.length-1;k++){
    const h=pts[i+k];
    if(pts[i+k+1][1]!==h[1])break;
    if(G(m,h[0],h[1]+1)===0&&G(m,h[0],h[1]+2)===0)T(m,h[0],h[1]+1,21);
   }
   i+=len+5;
  }
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
const BKINDS={
 center:{w:5,h:4,door:[2,3]},
 market:{w:4,h:4,door:[2,3]},
 gym:{w:5,h:5,door:[3,4]},
 house:{w:4,h:3,door:[1,2]},
 lab:{w:7,h:5,door:[3,4]},
 league:{w:8,h:5,door:[4,4]}
};
function placeBuilding(m,bx,by,kind,warpTo){
 const B=BKINDS[kind];
 for(let y=0;y<B.h;y++)for(let x=0;x<B.w;x++)T(m,bx+x,by+y,25);
 const dx=bx+B.door[0], dy=by+B.door[1];
 T(m,dx,dy,8);
 if(warpTo) m.warps[dx+','+dy]=warpTo;
 m.bldgs.push({x:bx,y:by,kind});
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
   placeBuilding(w,cx-9,cy-6,'center',{map:'center'+ti,x:4,y:5});
   placeBuilding(w,cx+5,cy-6,'market',{map:'market'+ti,x:4,y:5});
  }
  if(tw.gym) placeBuilding(w,cx-3,cy+4,'gym',{map:'gym'+ti,x:5,y:11});
  if(tw.lab) placeBuilding(w,cx-3,cy+4,'lab',{map:'lab',x:5,y:7});
  if(tw.league) placeBuilding(w,cx-4,cy-6,'league',{map:'league',x:6,y:26});
  // case
  if(!tw.league){
   placeBuilding(w,cx-10,cy+6,'house',{map:'house'+ti,x:3,y:4});
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
   const pts=routePts[r];
   const i=Math.min(pts.length-1,Math.floor(tr.f*pts.length));
   const p=pts[i], q=pts[Math.min(pts.length-1,i+2)];
   const vert=Math.abs(q[1]-p[1])>=Math.abs(q[0]-p[0]);
   let cx=p[0]+(vert?1:0), cy=p[1]+(vert?0:1);
   const walk=t=>t===0||t===1||t===4;
   if(!walk(G(w,cx,cy))){ cx=p[0]-(vert?1:0); cy=p[1]-(vert?0:1); }
   if(!walk(G(w,cx,cy))){ cx=p[0]+(vert?1:0); cy=p[1]+(vert?0:1); T(w,cx,cy,0); }
   const id='rt'+r+'_'+tr.name.replace(/\W/g,'');
   w.npcs.push({x:cx,y:cy,dir:vert?3:0,spr:'T',cls:tr.cls,trainer:{id,name:tr.name,party:tr.party,money:tr.party[tr.party.length-1][1]*40,t:tr.t,l:tr.l,double:tr.double}});
  }
 }
 // guardia della Lega sul percorso finale
 {
  const pts=routePts[8]; const p=pts[Math.floor(.12*pts.length)];
  for(let ox=-2;ox<=2;ox++)for(let oy=-2;oy<=2;oy++){ if(ox===0&&oy===0)continue; const x=p[0]+ox,y=p[1]+oy; if(ZONE[y*WORLD_W+x]===9||G(w,x,y)===3||G(w,x,y)===0||G(w,x,y)===1){ if(Math.abs(ox)<=1&&Math.abs(oy)<=1)T(w,x,y,6); } }
  T(w,p[0],p[1],3);
  w.npcs.push({x:p[0],y:p[1],dir:2,spr:4,guard:true,text:'Questa è la Via della Lega! Possono passare solo gli allenatori con tutte le 8 medaglie di Valmora.'});
 }
 // Team Ombra: reclute a Ondaporto (compaiono dopo la 1ª medaglia)
 {
  const t2=TOWNS[2];
  const duo=[[42,13],[36,13],[29,14],[10,13]];
  const mkO=(id,x,y,txt,lose)=>({x,y,dir:2,spr:'E',cls:'ombra',
    cond:()=>GS.badges.length>=1&&!GS.flags.ombra1,
    trainer:{id,name:'Reclute Ombra',party:duo,money:1000,double:true,t:txt,l:lose}});
  w.npcs.push(mkO('ombra1a',t2.x-4,t2.y-1,
   'Il Team Ombra si prende ciò che vuole! Anche questo Market! Noi lottiamo in coppia!','Ritirata strategica...'));
  w.npcs.push(mkO('ombra1b',t2.x+4,t2.y-1,
   'Non impicciarti degli affari del Team Ombra, moccioso! In due ti schiacciamo!','Il capo non deve saperlo!'));
 }
 // covo del Team Ombra a nord-est di Tossinia
 {
  const t5=TOWNS[5];
  const dx=t5.x+11, dy=t5.y-7;
  T(w,dx-1,dy,2); T(w,dx+1,dy,2); T(w,dx,dy,8);
  w.warps[dx+','+dy]={map:'covo',x:7,y:11};
  T(w,dx-2,dy+1,7);
  w.signs[(dx-2)+','+(dy+1)]='COVO DEL TEAM OMBRA — VIETATO L\'INGRESSO! (soprattutto ai mocciosi con le medaglie)';
 }
 // altare di Solverio vicino alla Lega
 { const ax=TOWNS[9].x+8, ay=TOWNS[9].y+8; T(w,ax,ay,20); w.signs[ax+','+ay]='ALTARE'; }
 buildInteriors();
 buildCovo();
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
function buildCovo(){
 const cv2=stdInterior('covo',15,13);
 for(const p of [[3,3],[11,3],[3,8],[11,8]])T(cv2,p[0],p[1],18);
 T(cv2,7,12,12); cv2.warps['7,12']={map:'world',x:TOWNS[5].x+11,y:TOWNS[5].y-6};
 cv2.npcs.push({x:4,y:5,dir:1,spr:'E',cls:'ombra',trainer:{id:'ombraC1',name:'Recluta Ombra',party:[[43,26],[37,26]],money:900,t:'Come sei entrato?! Fuori di qui!',l:'Il capo mi degrada di sicuro...'}});
 cv2.npcs.push({x:10,y:5,dir:3,spr:'E',cls:'ombra',trainer:{id:'ombraC2',name:'Recluta Ombra',party:[[31,27],[36,26]],money:900,t:'Qui prepariamo il risveglio del custode Solverio!',l:'Ho... ho parlato troppo.'}});
 cv2.npcs.push({x:7,y:8,dir:2,spr:'E',cls:'ombra',trainer:{id:'ombraC3',name:'Recluta Ombra',party:[[11,27],[42,26],[29,27]],money:900,t:'Nessuno disturba l\'Ammiraglia Vipera!',l:'V-Vipera... aiuto...'}});
 cv2.npcs.push({x:7,y:2,dir:2,spr:'C',cls:'ombra',trainer:{id:'ombraAdmin',name:'Ammiraglia Vipera',party:[[37,30],[43,30],[31,32]],money:2500,t:'Il Team Ombra risveglierà Solverio, e con il custode domineremo Valmora! Non puoi fermare il capo Nox!',l:'Nox... perdonami. Ci vediamo all\'altare del custode, moccioso: porta 7 medaglie e capirai tutto.'}});
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
 if(badges>=2)s.push('superpozione','antigelo','antiscottatura','canna');
 if(badges>=3)s.push('supersfera','baccaoran','baccacura');
 if(badges>=4)s.push('curatotale');
 if(badges>=5)s.push('revitalizzante','carbone','gocciamistica','fogliamagica','magnete');
 if(badges>=6)s.push('ultrasfera','pozionemax');
 if(badges>=7)s.push('fasciafocus');
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

// tileset esterno opzionale: striscia orizzontale di tile 16x16 nell'ordine di TILE_ORDER
const TILE_ORDER=[0,1,2,3,4,'4b',5,'5b',6,7,8,9,11,12,13,14,15,16,17,18,19,20,30,31,32,33,34,21];
const TILESET={ok:false,map:{}};
const TREE={ok:false};
(function(){ if(typeof Image==='undefined')return; const img=new Image();
 img.onload=()=>{ TREE.img=img; TREE.ok=true; }; img.onerror=()=>{};
 img.src='assets/tiles/tree.png'; })();
const TITLEIMG={ok:false};
(function(){ if(typeof Image==='undefined')return; const img=new Image();
 img.onload=()=>{ TITLEIMG.img=img; TITLEIMG.ok=true; }; img.onerror=()=>{};
 img.src='assets/ui/title.png'; })();
const HEROIMG={ok:false}, NPCIMG={ok:false};
(function(){ if(typeof Image==='undefined')return;
 for(const [obj,src] of [[HEROIMG,'assets/sprites/chars/hero.png'],[NPCIMG,'assets/sprites/chars/npcs.png']]){
  const img=new Image();
  img.onload=()=>{ obj.img=img; obj.ok=true; };
  img.onerror=()=>{};
  img.src=src;
 }
})();
const NPC_ROW={0:0,1:1,2:2,3:3,4:4,'P':5,'N':6,'M':7,'T':8,'L':9,'E':10,'C':11};
const BIMG={};
function bldgImg(kind){ if(BIMG[kind])return BIMG[kind]; const img=new Image(); img.src='assets/tiles/buildings/'+kind+'.png'; BIMG[kind]=img; return img; }
(function(){
 if(typeof Image==='undefined')return;
 const img=new Image();
 img.onload=()=>{ TILE_ORDER.forEach((k,i)=>TILESET.map[k]=i); TILESET.map[25]=0; TILESET.img=img; TILESET.ok=true; };
 img.onerror=()=>{};
 img.src='assets/tiles/tileset.png';
})();
function renderTile(id,f){
 f=f||0;
 const key=id+'_'+f;
 if(tileCache[key])return tileCache[key];
 const c=mkCanvas(16,16), g=c.getContext('2d');
 const rng=mulberry32(id*7919+11);
 const F=(col)=>{g.fillStyle=col;g.fillRect(0,0,16,16);};
 const R2=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
 const grass=()=>{
  F('#80c860');
  g.fillStyle='#78bc58';
  for(let y=0;y<16;y+=4)for(let x=(y%8?4:0);x<16;x+=8)g.fillRect(x,y,4,4);
  g.fillStyle='#68b048';
  for(let i=0;i<7;i++)g.fillRect(Math.floor(rng()*14),Math.floor(rng()*14),2,1);
  g.fillStyle='#94d474';
  for(let i=0;i<5;i++)g.fillRect(Math.floor(rng()*15),Math.floor(rng()*15),1,1);
 };
 const roof=(base,dark,light)=>{
  F(base);
  g.fillStyle=dark;
  for(let y=3;y<16;y+=4)g.fillRect(0,y,16,1);
  for(let y=0;y<16;y+=4)for(let x=((y/4)%2)?2:6;x<16;x+=8)g.fillRect(x,y,1,3);
  R2(0,0,16,2,light);
 };
 switch(id){
  case 0: case 25: grass(); break;
  case 1: { grass();
   const tuft=(x,y)=>{
    R2(x+1,y,2,1,'#2e7028'); R2(x,y+1,4,2,'#388830'); R2(x-1,y+3,6,3,'#2e7028');
    R2(x,y+3,1,3,'#4aa244'); R2(x+3,y+4,1,2,'#4aa244'); R2(x+1,y+2,1,4,'#1e5c1c');
   };
   tuft(2,1); tuft(9,2); tuft(5,7); tuft(11,8); tuft(1,9);
   break; }
  case 2: { grass();
   R2(6,11,4,4,'#7a4a22'); R2(7,11,1,4,'#94602e'); R2(6,14,4,1,'#5c3618');
   g.fillStyle='#1e5c20'; g.beginPath(); g.arc(8,7,7,0,7); g.fill();
   g.fillStyle='#2e7c30'; g.beginPath(); g.arc(8,6,6,0,7); g.fill();
   g.fillStyle='#3f9840'; g.beginPath(); g.arc(7,5,4.5,0,7); g.fill();
   R2(4,2,2,2,'#57b455'); R2(8,3,3,1,'#57b455'); R2(3,6,2,1,'#57b455'); R2(10,6,2,2,'#2e7c30');
   break; }
  case 3: { F('#e0d098');
   g.fillStyle='#d0bc80';
   for(let i=0;i<11;i++)g.fillRect(Math.floor(rng()*14),Math.floor(rng()*14),2,1);
   g.fillStyle='#f0e2b0';
   for(let i=0;i<6;i++)g.fillRect(Math.floor(rng()*15),Math.floor(rng()*15),1,1);
   g.fillStyle='#c4ac70';
   for(let i=0;i<4;i++)g.fillRect(Math.floor(rng()*14),Math.floor(rng()*14),1,1);
   break; }
  case 4: { grass();
   const flower=(x,y,ccol)=>{
    g.fillStyle='#f8f8f8';
    if(f===0){ g.fillRect(x-2,y,2,2); g.fillRect(x+2,y,2,2); g.fillRect(x,y-2,2,2); g.fillRect(x,y+2,2,2); }
    else { g.fillRect(x-2,y-2,2,2); g.fillRect(x+2,y-2,2,2); g.fillRect(x-2,y+2,2,2); g.fillRect(x+2,y+2,2,2); }
    R2(x,y,2,2,ccol);
   };
   flower(4,4,'#f8c020'); flower(11,10,'#e04838');
   break; }
  case 5: { F('#4890e0');
   g.fillStyle='#3878c8';
   for(let y=0;y<16;y+=4)for(let x=(y%8?4:0);x<16;x+=8)g.fillRect(x,y,4,4);
   const off=f?3:0;
   const wave=(x,y)=>{ R2((x+off)%14,y,5,1,'#a8d0f8'); R2((x+off)%14+1,y+1,3,1,'#2c68b8'); };
   wave(2,3); wave(8,8); wave(3,12);
   break; }
  case 6: { grass();
   R2(1,4,3,10,'#c09858'); R2(12,4,3,10,'#c09858');
   R2(1,4,3,1,'#e0c088'); R2(12,4,3,1,'#e0c088');
   R2(1,13,3,1,'#7a5a2a'); R2(12,13,3,1,'#7a5a2a');
   R2(0,6,16,2,'#d0a868'); R2(0,10,16,2,'#d0a868');
   R2(0,7,16,1,'#8a6534'); R2(0,11,16,1,'#8a6534');
   break; }
  case 7: { grass();
   R2(7,9,2,6,'#8a6534'); R2(7,14,2,1,'#5c3f1c');
   R2(2,2,12,8,'#c89858'); g.strokeStyle='#6a4a24'; g.lineWidth=1; g.strokeRect(2.5,2.5,11,7);
   R2(4,4,8,1,'#6a4a24'); R2(4,6,6,1,'#6a4a24');
   break; }
  case 8: { F('#c8b090');
   R2(1,0,14,16,'#8a6534');
   R2(3,2,10,14,'#6a4322');
   R2(4,3,8,5,'#7a5330'); R2(4,9,8,5,'#7a5330');
   R2(11,9,2,2,'#f0d060');
   R2(3,14,10,2,'#4c2f14');
   break; }
  case 9: { F('#e0d8c8');
   R2(0,0,16,1,'#f0e8d8');
   g.fillStyle='#c0b8a8';
   for(let y=4;y<16;y+=4)g.fillRect(0,y,16,1);
   for(let y=0;y<16;y+=4)for(let x=((y/4)%2)?3:7;x<16;x+=8)g.fillRect(x,y+1,1,3);
   R2(0,14,16,2,'#b0a898');
   break; }
  case 11: { F('#e0d8c8');
   g.fillStyle='#c0b8a8'; for(let y=4;y<16;y+=4)g.fillRect(0,y,16,1);
   R2(2,2,12,10,'#8a6534');
   R2(3,3,10,8,'#4878b8');
   R2(4,4,3,3,'#a8d0f0'); R2(8,7,4,2,'#88b8e0');
   R2(2,12,12,2,'#c0a878'); R2(2,13,12,1,'#8a6534');
   break; }
  case 12: { F('#b03830');
   R2(1,1,14,14,'#d05048');
   R2(3,3,10,10,'#e87868');
   R2(6,6,4,1,'#b03830'); R2(7,7,2,2,'#b03830'); R2(5,5,1,1,'#b03830'); R2(10,5,1,1,'#b03830');
   break; }
  case 13: { F('#e8c890');
   g.fillStyle='#d0a868';
   for(let y=3;y<16;y+=4)g.fillRect(0,y,16,1);
   for(let y=0;y<16;y+=4)for(let x=((y/4)%2)?4:10;x<16;x+=12)g.fillRect(x,y,1,3);
   g.fillStyle='#f4dca8';
   for(let i=0;i<4;i++)g.fillRect(Math.floor(rng()*14),Math.floor(rng()*14),2,1);
   break; }
  case 14: { F('#902820');
   R2(1,1,14,14,'#c04838');
   R2(3,3,10,10,'#d05848');
   g.fillStyle='#e8a068';
   g.fillRect(4,4,1,1); g.fillRect(11,4,1,1); g.fillRect(4,11,1,1); g.fillRect(11,11,1,1);
   R2(7,7,2,2,'#e8a068');
   break; }
  case 15: { F('#b08048');
   R2(0,0,16,5,'#d8b070'); R2(0,0,16,1,'#f0d090');
   R2(0,5,16,2,'#8a6030');
   g.fillStyle='#9a7038'; for(let x=3;x<16;x+=5)g.fillRect(x,8,1,8);
   break; }
  case 16: { F('#e8e0d0');
   R2(1,4,14,11,'#d84848'); R2(1,4,14,1,'#f07070'); R2(1,14,14,1,'#a03030');
   R2(4,1,8,5,'#b8e0f8'); g.strokeStyle='#888'; g.strokeRect(4.5,1.5,7,4);
   R2(3,9,2,2,'#68e068'); R2(7,9,2,2,'#f0d050'); R2(11,9,2,2,'#f08050');
   break; }
  case 17: { F('#e8e0d0');
   R2(2,2,12,9,'#585858');
   R2(4,4,8,5,'#78e090'); R2(4,6,8,1,'#58c070');
   R2(6,11,4,2,'#484848');
   R2(3,13,10,2,'#a8a8a8'); R2(3,13,10,1,'#c8c8c8');
   break; }
  case 18: { F('#7a4a22');
   R2(1,1,14,14,'#5c3618');
   R2(2,2,12,5,'#3c2410'); R2(2,9,12,5,'#3c2410');
   const cols=['#d04040','#4060d0','#40a050','#d0a040','#9050c0','#d07030'];
   for(let i=0;i<6;i++){ R2(2+i*2,2,2,5,cols[i]); R2(2+i*2,2,1,5,shade(cols[i],30)); }
   for(let i=0;i<6;i++){ R2(2+i*2,9,2,5,cols[5-i]); R2(2+i*2,9,1,5,shade(cols[5-i],30)); }
   R2(2,7,12,1,'#8a6534'); R2(2,14,12,1,'#8a6534');
   break; }
  case 19: { F('#e8c890');
   g.fillStyle='#d0a868'; for(let y=3;y<16;y+=4)g.fillRect(0,y,16,1);
   R2(3,12,10,3,'#888888'); R2(3,12,10,1,'#a8a8a8');
   R2(5,4,6,8,'#b0b0b8'); R2(5,4,2,8,'#c8c8d0');
   R2(6,1,4,4,'#c0c0c8'); R2(6,1,2,2,'#d8d8e0');
   g.strokeStyle='#707078'; g.strokeRect(5.5,4.5,5,7);
   break; }
  case 21: { grass();
   R2(0,8,16,3,'#e0c078'); R2(0,8,16,1,'#f0d898');
   R2(0,11,16,2,'#a88448'); R2(0,13,16,1,'#7a5f30');
   break; }
  case 20: { grass();
   R2(2,7,12,7,'#c8c8d8'); R2(2,7,12,1,'#e0e0ec'); R2(2,13,12,1,'#9898a8');
   R2(1,14,14,2,'#a8a8b8');
   R2(6,3,4,4,'#f8e040'); R2(7,2,2,1,'#f8e040'); R2(7,4,2,2,'#fff8a0');
   R2(5,4,1,2,'#f8e040'); R2(10,4,1,2,'#f8e040');
   break; }
  case 30: roof('#e05048','#b03028','#f08078'); break;
  case 31: roof('#4878d0','#3058a8','#78a0e8'); break;
  case 32: roof('#d8a838','#a87c20','#f0c860'); break;
  case 33: roof('#98a0a8','#707880','#c0c8d0'); break;
  case 34: roof('#9060c8','#6c40a0','#b490e0'); break;
  default: F('#000');
 }
 tileCache[key]=c; return c;
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
// sprite fakemon incorporati: vedi SPRITE_DATA nel blocco dati
const imgCache={};
function monImg(id,back,shiny){const key=id+(back?'b':'f')+(shiny?'s':'');if(imgCache[key])return imgCache[key];const img=new Image();img.src='assets/sprites/'+(back?'back':'front')+(shiny?'_shiny':'')+'/'+id+'.png';imgCache[key]=img;return img;}
function imgReady(img){ return img.complete&&img.naturalWidth>0; }
function drawMon(g,id,x,y,w,h,shiny){const img=monImg(id,false,shiny);g.imageSmoothingEnabled=false;if(imgReady(img))g.drawImage(img,x,y,w,h);else g.drawImage(monSprite(id),x,y,w,h);}
function drawMonBack(g,id,x,y,w,h,shiny){const img=monImg(id,true,shiny);g.imageSmoothingEnabled=false;if(imgReady(img))g.drawImage(img,x,y,w,h);else { const c=monSprite(id); g.drawImage(c,0,0,48,30,x+w*0.1,y+h*0.25,w*0.8,h*0.55); }}
function monIcon(id){ const key='i'+id; if(imgCache[key])return imgCache[key]; const img=new Image(); img.src='assets/sprites/icons/'+id+'.png'; imgCache[key]=img; return img; }
function drawMonIcon(g,id,x,y,w,h){ const img=monIcon(id); g.imageSmoothingEnabled=false; if(imgReady(img))g.drawImage(img,x,y,w,h); else drawMon(g,id,x,y,w,h); }
function preloadSprites(){for(const sp of DEX){ monImg(sp.id,false); monImg(sp.id,true); monIcon(sp.id); }}

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
 const isHero=pal==='HERO';
 const sheet=isHero?HEROIMG:NPCIMG;
 if(sheet.ok){
  const CW=16,CH=24;
  let sxx,syy;
  let flip=(dir===1); // destra = sinistra specchiata
  if(isHero){
   const drow= dir===2?0 : dir===0?1 : 2;
   sxx=(frame%3)*CW; syy=drow*CH;
  } else {
   const row=NPC_ROW[pal]!==undefined?NPC_ROW[pal]:0;
   const dcol= dir===2?0 : dir===0?1 : 2;
   sxx=dcol*CW; syy=row*CH;
  }
  g.imageSmoothingEnabled=false;
  g.fillStyle='rgba(0,0,0,.22)';
  g.beginPath(); g.ellipse(sx+16,sy+29,10,4,0,0,7); g.fill();
  const dy=sy-16;
  if(flip){ g.save(); g.translate(sx+32,dy); g.scale(-1,1);
   g.drawImage(sheet.img,sxx,syy,CW,CH,0,0,32,48); g.restore(); }
  else g.drawImage(sheet.img,sxx,syy,CW,CH,sx,dy,32,48);
  return;
 }
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
 dex:{seen:{},caught:{}}, steps:0, anim:0, name:'ALEX', fx:[], visited:{0:1}
};
let dialogQ=null, menuState=null, battle=null, fade=0, fadeCb=null, cut=null;

function statCalc(base,lv,isHp){ return isHp? Math.floor(base*2*lv/100)+lv+10 : Math.floor(base*2*lv/100)+5; }
function mkMon(id,lv){
 const sp=SP(id);
 const m={id, lv, exp:lv*lv*lv, status:null, stages:{atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0}, moves:[], abil:ABIL[id]||null, held:null, shiny:R()<1/512};
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
 m.spa=statCalc(sp.bs[3],m.lv);
 m.spd=statCalc(sp.bs[4],m.lv);
 m.spe=statCalc(sp.bs[5],m.lv);
 if(old&&m.hp!==undefined) m.hp=Math.min(m.maxhp, m.hp+(m.maxhp-old));
}
function expForLv(lv){ return lv*lv*lv; }

function curMap(){ return MAPS[GS.map]; }
function tileAt(x,y){ return G(curMap(),x,y); }
function npcActive(n){ return !n.hidden && (!n.cond||n.cond()); }
function npcAt(x,y){ return curMap().npcs.find(n=>n.x===x&&n.y===y && npcActive(n)); }
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
 // dislivello: si salta solo verso il basso
 if(d===2&&tileAt(nx,ny)===21&&!isBlocked(nx,ny+1)){
  GS.moving=true; GS.jump=true; GS.mvx=nx; GS.mvy=ny+1; GS.mvt=0; sfx('run');
  return;
 }
 if(isBlocked(nx,ny))return;
 GS.moving=true; GS.mvx=nx; GS.mvy=ny; GS.mvt=0;
}
function arrive(){
 GS.px=GS.mvx; GS.py=GS.mvy; GS.moving=false; GS.jump=false; GS.steps++;
 const t=tileAt(GS.px,GS.py);
 const wkey=GS.px+','+GS.py;
 const warp=curMap().warps[wkey];
 if((t===8||t===12)&&warp){ doWarp(warp); return; }
 if(t===1)GS.fx.push({x:GS.px,y:GS.py,t0:GS.anim});
 if(GS.map==='world')for(let ti=0;ti<TOWNS.length;ti++){ const tw2=TOWNS[ti]; if(Math.abs(GS.px-tw2.x)<=13&&Math.abs(GS.py-tw2.y)<=11){ GS.visited[ti]=1; break; } }
 if(!battle)updateWorldMusic();
 if(checkRival())return;
 if(checkSight())return;
 if(t===1 && GS.map==='world'){
  const z=ZONE[GS.py*WORLD_W+GS.px];
  if(z>0 && R()<.12) startWild(z-1);
 }
}
// --- linea di vista degli allenatori ---
function checkSight(){
 const m=curMap();
 for(const n of m.npcs){
  if(!n.trainer||!npcActive(n)||n.guard||GS.defeated[n.trainer.id])continue;
  const [dx,dy]=DIRS[n.dir];
  for(let k=1;k<=5;k++){
   const tx=n.x+dx*k, ty=n.y+dy*k;
   if(GS.px===tx&&GS.py===ty){ startSight(n); return true; }
   if(SOLID.has(G(m,tx,ty))||npcAt(tx,ty))break;
  }
 }
 return false;
}
function startFishing(){
 menuState=null; GS.mode='world';
 if(GS.map!=='world'){ say('Qui non c\'è acqua in cui pescare!'); return; }
 const [dx,dy]=DIRS[GS.dir];
 if(tileAt(GS.px+dx,GS.py+dy)!==5){ say('Devi essere rivolto verso l\'acqua!'); return; }
 GS.mode='fish';
 cut={phase:'wait',t:0,bite:800+R()*1600};
 sfx('menu');
}
function startSight(n){ cut={n, phase:0, t:0}; GS.mode='cut'; sfx('a'); }
function cutUpdate(dt){
 const c=cut; if(!c){GS.mode='world';return;}
 c.t+=dt;
 if(c.phase===0){ if(c.t>550){ c.phase=1; c.t=170; } return; }
 const n=c.n;
 const dx=GS.px-n.x, dy=GS.py-n.y;
 if(Math.abs(dx)+Math.abs(dy)<=1){
  n.dir = dy>0?2: dy<0?0: dx>0?1:3;
  GS.dir=(n.dir+2)%4;
  const tr=n.trainer;
  cut=null; GS.mode='world';
  say(tr.name+': "'+tr.t+'"', ()=>startTrainerBattle(tr));
  return;
 }
 if(c.t>=170){
  c.t=0;
  if(Math.abs(dx)>Math.abs(dy)){ n.x+=Math.sign(dx); n.dir=dx>0?1:3; }
  else { n.y+=Math.sign(dy); n.dir=dy>0?2:0; }
 }
}
// --- rivale Milo: 3 battaglie lungo la storia ---
const RIVAL_CNT={1:[4,5,6],4:[7,8,9],7:[1,2,3]};
const RIVAL_BATTLES=[
 {id:'rival1', x0:25,x1:31, y0:180,y1:184, badges:0, money:600,
  party:s=>[[RIVAL_CNT[s][0],6],[10,6]],
  t:'Milo: "Eccoti, cugino di scelte facili! Il mio nuovo compagno scalpita: vediamo chi ha scelto meglio dal laboratorio dello zio!"',
  l:'Uff... hai solo avuto fortuna. Ci rivediamo più avanti!'},
 {id:'rival2', x0:83,x1:89, y0:120,y1:125, badges:2, money:1600,
  party:s=>[[13,18],[20,18],[RIVAL_CNT[s][1],20]],
  t:'Milo: "Di nuovo tu! Due medaglie anch\'io, e stavolta mi sono allenato sul serio!"',
  l:'Anche stavolta... incredibile. Ma alla Lega sarà diverso!'},
 {id:'rival3', x0:118,x1:124, y0:38,y1:42, badges:8, money:4000,
  party:s=>[[14,40],[22,41],[52,40],[RIVAL_CNT[s][2],42]],
  t:'Milo: "La Via della Lega! Sapevo che saresti arrivato fin qui. Prima della Lega, dovrai superare ME!"',
  l:'...Vai. Il titolo di Campione può essere solo tuo. Rendici fieri!'}
];
function checkRival(){
 if(GS.map!=='world')return false;
 for(const rb of RIVAL_BATTLES){
  if(GS.defeated[rb.id])continue;
  if(GS.badges.length<rb.badges)continue;
  if(GS.px>=rb.x0&&GS.px<=rb.x1&&GS.py>=rb.y0&&GS.py<=rb.y1){
   const st=GS.flags.starterId||1;
   const tr={id:rb.id,name:'Rivale Milo',party:rb.party(st),money:rb.money,t:rb.t,l:rb.l};
   say(rb.t,()=>startTrainerBattle(tr));
   return true;
  }
 }
 return false;
}
function doWarp(w){
 fadeOut(()=>{ GS.map=w.map; GS.px=w.x; GS.py=w.y; GS.moving=false;
  if(w.map!=='world')GS.dir=0; else GS.dir=2; updateWorldMusic(); fadeIn(); });
}
function fadeOut(cb){ fade=0.01; fadeCb=cb; }
function fadeIn(){ fade=-1; }

function interact(){
 const [dx,dy]=DIRS[GS.dir], tx=GS.px+dx, ty=GS.py+dy;
 const t=tileAt(tx,ty);
 const skey=tx+','+ty;
 let n=npcAt(tx,ty);
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
 if(!GS.flags.teamDone){
  if(GS.badges.length<7){
   say('Una figura incappucciata scruta l\'altare da lontano e sparisce tra gli alberi... Qualcosa di grosso si prepara. (Si dice che con 7 medaglie i grandi eventi si rivelino.)');
   return;
  }
  say('Nox, capo del Team Ombra: "Finalmente! Il custode Solverio si risveglierà per ME! Tu... le tue medaglie non ti salveranno!"',
   ()=>startTrainerBattle({id:'ombraBoss',name:'Capo Nox',party:[[43,44],[37,44],[31,45],[48,46]],money:6000,
     t:'x',l:'Impossibile... il custode non mi ha scelto... Forse, ragazzo... sceglierà te.'}));
  return;
 }
 if(GS.flags.solverio){ say('L\'altare è silenzioso. La leggenda si è già compiuta.'); return; }
 say('Una luce accecante avvolge l\'altare... SOLVERIO, il custode di Valmora, ti riconosce e si risveglia!', ()=>{
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
  musicKick();
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
  else if(k==='m'){ SND.mute=!SND.mute; updateMute(); }
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
const JINGLES={
 lvl:[[523,90],[659,90],[784,90],[1047,180]],
 catch:[[392,80],[523,80],[659,80],[784,240]],
 badge:[[523,110],[523,60],[659,110],[784,110],[1047,280]],
 heal:[[880,90],[988,90],[1175,200]],
 evolve:[[440,80],[554,80],[659,80],[880,80],[1109,240]],
 victory:[[784,100],[784,60],[784,60],[784,100],[622,130],[698,130],[784,90],[698,60],[784,300]]
};
function playJingle(notes){
 try{
  if(!SND.ctx)SND.ctx=new (window.AudioContext||window.webkitAudioContext)();
  const ac=SND.ctx; let t=ac.currentTime;
  for(const nd of notes){
   const o=ac.createOscillator(), g=ac.createGain();
   o.type='square'; o.frequency.setValueAtTime(nd[0],t);
   g.gain.setValueAtTime(.07,t);
   g.gain.exponentialRampToValueAtTime(.001,t+nd[1]/1000);
   o.connect(g); g.connect(ac.destination);
   o.start(t); o.stop(t+nd[1]/1000+.01);
   t+=nd[1]/1000*0.92;
  }
 }catch(e){}
}
function cry(id,faint){
 if(SND.mute)return;
 try{
  if(!SND.ctx)SND.ctx=new (window.AudioContext||window.webkitAudioContext)();
  const ac=SND.ctx, rng=mulberry32((id*2654435761)%2147483647);
  let t=ac.currentTime;
  const segs=2+Math.floor(rng()*3);
  const sp=SP(id);
  const heavy=(sp.bs[0]+sp.bs[1])/2;
  const base=(1150-heavy*6)*(faint?0.55:1);
  for(let i=0;i<segs;i++){
   const o=ac.createOscillator(), g=ac.createGain();
   o.type=['square','sawtooth','triangle'][Math.floor(rng()*3)];
   const f=Math.max(90,base*(0.7+rng()*0.8));
   const d=(0.05+rng()*0.09)*(faint?1.7:1);
   o.frequency.setValueAtTime(f,t);
   o.frequency.linearRampToValueAtTime(Math.max(60,f*(0.6+rng()*0.9)),t+d);
   g.gain.setValueAtTime(.09,t);
   g.gain.exponentialRampToValueAtTime(.001,t+d);
   o.connect(g); g.connect(ac.destination);
   o.start(t); o.stop(t+d+.01);
   t+=d*0.9;
  }
 }catch(e){}
}
const SFXF={};
function sfx(kind){
 if(SND.mute)return;
 let a=SFXF[kind];
 if(a===undefined){
  a=new Audio('assets/audio/sfx/'+kind+'.mp3');
  a.volume=.6;
  a.addEventListener('error',()=>{ a.bad=true; });
  SFXF[kind]=a;
 }
 if(a&&!a.bad&&a.readyState>=2){ try{ a.currentTime=0; a.play().catch(()=>{}); return; }catch(e){} }
 beep(kind);
}
// musica di sottofondo: assets/audio/music/{title,overworld,battle}.mp3 (loop, opzionali)
const MUSIC={cur:null,name:null,started:false,tracks:{}};
const PMUSIC={name:null,timer:null};
function midiHz(n){ return 440*Math.pow(2,(n-69)/12); }
function scaleAt(sc,d){ const o=Math.floor(d/7); return sc[((d%7)+7)%7]+o*12; }
function pnote(ac,f,t,d,type,vol){
 const o=ac.createOscillator(),g=ac.createGain();
 o.type=type; o.frequency.setValueAtTime(f,t);
 g.gain.setValueAtTime(vol,t);
 g.gain.exponentialRampToValueAtTime(.001,t+d);
 o.connect(g); g.connect(ac.destination);
 o.start(t); o.stop(t+d+.02);
}
function stopProc(){ if(PMUSIC.timer){clearTimeout(PMUSIC.timer);PMUSIC.timer=null;} PMUSIC.name=null; }
function startProc(name){
 stopProc();
 const spec={
  title:{bpm:92,root:57,mode:'minor',prog:[0,5,3,4]},
  overworld:{bpm:126,root:60,mode:'major',prog:[0,3,4,0]},
  town:{bpm:100,root:62,mode:'major',prog:[0,4,5,3]},
  battle:{bpm:154,root:57,mode:'minor',prog:[0,0,3,4]}
 }[name];
 if(!spec)return;
 try{ if(!SND.ctx)SND.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
 const ac=SND.ctx;
 PMUSIC.name=name;
 const sc=spec.mode==='major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
 const rng=mulberry32(name.length*7919+name.charCodeAt(0)*131+name.charCodeAt(name.length-1));
 const mel=[]; let deg=2;
 for(let i=0;i<32;i++){ deg=Math.max(-2,Math.min(10,deg+Math.floor(rng()*5)-2)); mel.push(rng()<.18?null:deg); }
 const beat=60/spec.bpm/2;
 let bar=0;
 function schedule(){
  if(PMUSIC.name!==name||SND.mute)return;
  const t0=ac.currentTime+0.06;
  const chord=spec.prog[bar%4];
  for(let i=0;i<8;i++){
   const t=t0+i*beat;
   if(i%2===0)pnote(ac,midiHz(spec.root-12+scaleAt(sc,chord)),t,beat*1.6,'triangle',.05);
   const d=mel[(bar%4)*8+i];
   if(d!==null)pnote(ac,midiHz(spec.root+scaleAt(sc,d+chord)),t,beat*0.9,'square',.028);
  }
  bar++;
  PMUSIC.timer=setTimeout(schedule,beat*8*1000-40);
 }
 schedule();
}
function playMusic(name,force){
 if(!force&&MUSIC.started&&MUSIC.name===name)return;
 MUSIC.name=name;
 if(!MUSIC.started)return;
 let a=MUSIC.tracks[name];
 if(a===undefined){
  a=new Audio('assets/audio/music/'+name+'.mp3');
  a.loop=true; a.volume=.4;
  a.addEventListener('error',()=>{ a.bad=true; if(MUSIC.name===name)startProc(name); });
  a.addEventListener('canplaythrough',()=>{ if(MUSIC.cur===a)stopProc(); });
  MUSIC.tracks[name]=a;
 }
 if(MUSIC.cur&&MUSIC.cur!==a)MUSIC.cur.pause();
 MUSIC.cur=a;
 stopProc();
 if(SND.mute)return;
 if(a&&!a.bad){
  const pr=a.play(); if(pr&&pr.catch)pr.catch(()=>{});
  if(a.readyState===0)setTimeout(()=>{ if(MUSIC.name===name&&(a.bad||a.readyState===0))startProc(name); },350);
 } else startProc(name);
}
function updateWorldMusic(){
 let tr='overworld';
 if(GS.map!=='world')tr='town';
 else for(const t of TOWNS){ if(Math.abs(GS.px-t.x)<=13&&Math.abs(GS.py-t.y)<=11){ tr='town'; break; } }
 playMusic(tr);
}
function musicKick(){ if(!MUSIC.started){ MUSIC.started=true; if(MUSIC.name)playMusic(MUSIC.name,true); } }
function updateMute(){ if(SND.mute){ if(MUSIC.cur)MUSIC.cur.pause(); stopProc(); } else if(MUSIC.name)playMusic(MUSIC.name,true); }
function beep(kind){
 if(SND.mute)return;
 if(JINGLES[kind]){ playJingle(JINGLES[kind]); return; }
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
const START_ITEMS=['DEX','SQUADRA','ZAINO','MAPPA','ALLENATORE','SALVA','CHIUDI'];
let MINIMAP=null;
function buildMinimap(){
 const w=MAPS.world;
 const c=mkCanvas(WORLD_W,WORLD_H), g=c.getContext('2d');
 const col={0:'#7cc8a0',25:'#7cc8a0',1:'#4ea06c',2:'#2e6c38',3:'#e6d7a0',4:'#7cc8a0',5:'#4890e0',6:'#b89058',7:'#b89058',8:'#8a5a3a',9:'#c8c8c8',11:'#c8c8c8',20:'#e8e058',21:'#c8a060'};
 for(let y=0;y<w.h;y++)for(let x=0;x<w.w;x++){
  g.fillStyle=col[G(w,x,y)]||'#2e6c38';
  g.fillRect(x,y,1,1);
 }
 for(const bd of w.bldgs){ const B=BKINDS[bd.kind]; g.fillStyle='#d05048'; g.fillRect(bd.x,bd.y,B.w,B.h); }
 MINIMAP=c;
}

function bagList(){ return Object.keys(GS.bag).filter(k=>GS.bag[k]>0); }

function menuInput(ev){
 const M=menuState;
 if(!M)return;
 if(M.kind==='start'){
  if(ev==='U'){M.sel=(M.sel+6)%7;sfx('menu');}
  else if(ev==='D'){M.sel=(M.sel+1)%7;sfx('menu');}
  else if(ev==='B'||ev==='S'){GS.mode='world';menuState=null;sfx('b');}
  else if(ev==='A'){
   sfx('a');
   const it=START_ITEMS[M.sel];
   if(it==='DEX')menuState={kind:'dex',sel:0};
   else if(it==='SQUADRA')menuState={kind:'party',sel:0,ctx:'world'};
   else if(it==='ZAINO')menuState={kind:'bag',sel:0,ctx:'world'};
   else if(it==='MAPPA')menuState={kind:'map',sel:0};
   else if(it==='ALLENATORE')menuState={kind:'card'};
   else if(it==='SALVA'){saveGame();say('Partita salvata! (Suggerimento: puoi anche esportarla in file dal pulsante sotto lo schermo.)');menuState=null;}
   else {GS.mode='world';menuState=null;}
  }
 }
 else if(M.kind==='card'){ if(ev==='A'||ev==='B'){menuState={kind:'start',sel:4};sfx('b');} }
 else if(M.kind==='map'){
  const vis=Object.keys(GS.visited||{0:1}).map(Number).sort((a,b2)=>a-b2);
  if(ev==='L'||ev==='U'){M.sel=(M.sel+vis.length-1)%vis.length;sfx('menu');}
  else if(ev==='R'||ev==='D'){M.sel=(M.sel+1)%vis.length;sfx('menu');}
  else if(ev==='B'){menuState={kind:'start',sel:3};sfx('b');}
  else if(ev==='A'){
   if(GS.badges.length<3){ sfx('b'); return; }
   if(GS.map!=='world'){ menuState=null; say('Puoi usare il Volo solo all\'aperto!'); return; }
   const ti=vis[M.sel%vis.length];
   menuState=null; GS.mode='world'; sfx('run');
   fadeOut(()=>{ GS.px=TOWNS[ti].x; GS.py=TOWNS[ti].y+1; GS.dir=2; GS.moving=false; fadeIn(); });
  }
 }
 else if(M.kind==='dex'){
  if(ev==='U'){M.sel=Math.max(0,M.sel-1);sfx('menu');}
  else if(ev==='D'){M.sel=Math.min(DEX.length-1,M.sel+1);sfx('menu');}
  else if(ev==='B'){menuState={kind:'start',sel:0};sfx('b');}
  else if(ev==='A'){ const sp2=DEX[M.sel]; if(GS.dex.seen[sp2.id])cry(sp2.id); }
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
   else if(M.ctx==='switch'){
    menuState=null;GS.mode='battle';
    if(battle&&battle.freeSwitch){ battle.freeSwitch=false; sendNextFoe(); }
    else battleMenuBack();
   }
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
 else if(M.kind==='stats'){
  if(ev==='L'||ev==='R'){M.page=1-(M.page||0);sfx('menu');}
  else if(ev==='A'||ev==='B'){menuState={kind:'party',sel:M.monSel,ctx:'world'};sfx('b');}
 }
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
   } else if(it.tool==='fish'){
    if(M.ctx==='battle'){ menuState=null; say('Non è il momento di pescare!', ()=>{GS.mode='battle';battleMenuBack();}); }
    else startFishing();
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
   GS.party.push(mon); GS.flags.starter=true; GS.flags.starterId=id;
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
 else if(M.kind==='yesno'){
  if(ev==='U'||ev==='D'){M.sel=1-(M.sel||0);sfx('menu');}
  else if(ev==='A'){ sfx('a'); const f=(M.sel||0)===0?M.yes:M.no; menuState=null; f(); }
  else if(ev==='B'){ sfx('b'); const f=M.no; menuState=null; f(); }
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
 if(it.hold){
  if(ctx==='battle'){ menuState=null; say('Non puoi assegnare strumenti durante la lotta!', ()=>{GS.mode='battle';battleMenuBack();}); return; }
  const prev=mon.held;
  mon.held=k; GS.bag[k]--;
  if(prev)GS.bag[prev]=(GS.bag[prev]||0)+1;
  sfx('a'); menuState=null;
  say(SP(mon.id).n+' ora tiene: '+it.n+'.'+(prev?' (Hai ripreso '+ITEMS[prev].n+'.)':''));
  return;
 }
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
 if(GS.mode==='cut'){ cutUpdate(dt); return; }
 if(GS.mode==='fish'){
  cut.t+=dt;
  if(cut.phase==='wait'){
   if(ev==='A'||ev==='B'){ cut=null; GS.mode='world'; say('Niente... hai ritirato la lenza troppo presto.'); return; }
   if(cut.t>=cut.bite){ cut.phase='bite'; cut.t=0; sfx('a'); }
  } else {
   if(ev==='A'){
    cut=null; GS.mode='world';
    const pool=[[27,25],[7,20],[53,18],[49,12],[28,15],[9,10]];
    let tot=0; for(const q of pool)tot+=q[1];
    let r=R()*tot, pick=pool[0][0];
    for(const q of pool){ r-=q[1]; if(r<=0){pick=q[0];break;} }
    const lv=Math.min(45,8+GS.badges.length*3+Math.floor(R()*5));
    const fm=mkMon(pick,lv);
    say('Abboccato!',()=>startWildMon(fm,0));
    return;
   }
   if(cut.t>700){ cut=null; GS.mode='world'; say('Il pesce si è liberato...'); return; }
  }
  return;
 }
 if(GS.mode==='battle'){ battleUpdate(dt, ev); return; }
 if(GS.mode==='world'){
  if(ev==='S'){ openStartMenu(); return; }
  if(ev==='A'){ interact(); return; }
  if(GS.moving){
   const corsa=(keys['Shift']||keys['x']||keys['X'])&&!GS.jump;
   GS.mvt+=dt/(GS.jump?340:(corsa?105:180));
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
 if(GS.mode==='battle'||battle){
  if(battle&&battle.intro>0){ drawWorld(); drawBattleIntro(); drawFade(); return; }
  drawBattle();
  if(GS.mode==='menu')drawMenu();
  if(GS.mode==='dialog')drawDialog();
  drawFade(); return;
 }
 drawWorld();
 if(GS.mode==='cut'&&cut)drawSightMark();
 if(GS.mode==='fish'&&cut)drawFishMark();
 if(GS.mode==='dialog')drawDialog();
 if(GS.mode==='menu')drawMenu();
 drawFade();
}
function drawFishMark(){
 const [ox,oy]=camPos();
 const x=GS.px*TD-ox, y=GS.py*TD-oy-48;
 box(x-4,y,40,30);
 txt(cut.phase==='bite'?'!':'...',x+8,y+7,cut.phase==='bite'?'#c03028':'#303030',15);
}
function drawSightMark(){
 const [ox,oy]=camPos();
 const n=cut.n;
 const x=n.x*TD-ox, y=n.y*TD-oy-46;
 box(x+2,y,26,28);
 txt('!',x+11,y+5,'#c03028',17);
}
function drawMoveFx(A){
 const p=Math.min(1,A.t/A.dur);
 const cx=A.side==='foe'?350:118, cy=A.side==='foe'?82:180;
 const rng=mulberry32(A.mt.charCodeAt(0)*97+A.mt.charCodeAt(1)*13);
 const PAL={FUO:['#f86038','#f8a030'],ACQ:['#48a0f8','#a8d8f8'],ERB:['#58c050','#a0e070'],ELE:['#f8e038','#fff8a0'],
  GHI:['#a0e8f8','#e0f8ff'],PSI:['#e070c8','#a058d8'],ROC:['#b09058','#806040'],TER:['#c8a050','#a08040'],
  VEL:['#b060c8','#7840a0'],SPE:['#6858a0','#382860'],DRA:['#8058e8','#b090f8'],VOL:['#d8e8f8','#a8c0d8'],
  INS:['#a8c020','#d0e060'],NOR:['#f0f0f0','#c8c8c8'],LOT:['#e07050','#c04028']};
 const cols=PAL[A.mt]||PAL.NOR;
 for(let i=0;i<11;i++){
  const ang=rng()*6.28, spd=12+rng()*32;
  let x=cx+Math.cos(ang)*spd*p, y=cy+Math.sin(ang)*spd*p;
  if(A.mt==='FUO')y-=p*22;
  if(A.mt==='ROC'||A.mt==='TER')y+=p*26;
  ctx.globalAlpha=1-p;
  ctx.fillStyle=cols[i%2];
  if(A.mt==='ELE')ctx.fillRect(x,y,2,9);
  else if(A.mt==='ERB'||A.mt==='VOL'||A.mt==='INS')ctx.fillRect(x,y,7,2);
  else if(A.mt==='PSI'){ ctx.beginPath(); ctx.arc(cx,cy,6+p*(10+i*3),0,7); ctx.strokeStyle=cols[i%2]; ctx.lineWidth=1.5; ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(x,y,3+rng()*4,0,7); ctx.fill(); }
 }
 ctx.globalAlpha=1;
}
function drawBattleIntro(){
 const b=battle, p=1-b.intro/800;
 if(p<0.4){
  if(Math.floor(b.intro/70)%2===0){ ctx.fillStyle='rgba(255,255,255,.75)'; ctx.fillRect(0,0,VW,VH); }
 } else {
  const r=(p-0.4)/0.6*Math.hypot(VW,VH)/2*1.15;
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.arc(VW/2,VH/2,r,0,7); ctx.fill();
 }
}
function drawWeatherFx(kind){
 const t=GS.anim;
 if(kind==='rain'){
  ctx.strokeStyle='rgba(120,160,255,.5)'; ctx.lineWidth=1.5;
  for(let i=0;i<38;i++){
   const x=((i*137)+t*0.25)%(VW+40)-20;
   const y=((i*89)+t*0.55)%(VH+30)-15;
   ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-3,y+11); ctx.stroke();
  }
 } else if(kind==='hail'){
  ctx.fillStyle='rgba(255,255,255,.8)';
  for(let i=0;i<30;i++){
   const x=(((i*151)+Math.sin(t/700+i)*30+t*0.06)%(VW+20)+VW+20)%(VW+20)-10;
   const y=((i*97)+t*0.18)%(VH+20)-10;
   ctx.fillRect(x,y,3,3);
  }
 } else if(kind==='sand'){
  ctx.fillStyle='rgba(220,190,120,.45)';
  for(let i=0;i<40;i++){
   const x=((i*113)+t*0.6)%(VW+30)-15;
   const y=(i*83+Math.sin(t/400+i)*20)%VH;
   ctx.fillRect(x,y,4,2);
  }
  ctx.fillStyle='rgba(210,180,110,.10)'; ctx.fillRect(0,0,VW,VH);
 }
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
  const t=G(m,x,y);
  if(t===2&&TREE.ok&&x>=0&&y>=0){
   if(TILESET.ok)ctx.drawImage(TILESET.img,0,0,16,16,x*TD-ox,y*TD-oy,TD,TD);
   ctx.drawImage(TREE.img,(x%2)*16,(y%2)*16,16,16,x*TD-ox,y*TD-oy,TD,TD);
   continue;
  }
  const fr=(t===5||t===4)?(Math.floor(GS.anim/550)%2):0;
  const tk=fr?(t+'b'):t;
  if(TILESET.ok&&TILESET.map[tk]!==undefined)ctx.drawImage(TILESET.img,TILESET.map[tk]*16,0,16,16,x*TD-ox,y*TD-oy,TD,TD);
  else ctx.drawImage(renderTile(t,fr), x*TD-ox, y*TD-oy, TD, TD);
 }
 // meteo ambientale
 if(GS.map==='world'){ const wz=zoneWeather(GS.px,GS.py); if(wz)drawWeatherFx(wz); }
 // fruscio dell'erba alta
 if(!GS.fx)GS.fx=[];
 GS.fx=GS.fx.filter(f=>GS.anim-f.t0<380);
 for(const f of GS.fx){
  const p=(GS.anim-f.t0)/380;
  ctx.globalAlpha=1-p;
  ctx.fillStyle='#2e7028';
  const fx2=f.x*TD-ox+TD/2, fy2=f.y*TD-oy+TD/2;
  for(let i=0;i<4;i++){
   const ang=i*1.57+.6;
   ctx.fillRect(fx2+Math.cos(ang)*(6+p*15)-2, fy2+Math.sin(ang)*(4+p*7)-p*13, 4,4);
  }
  ctx.globalAlpha=1;
 }
 // giocatore (posizione interpolata)
 let pxx=GS.px, pyy=GS.py;
 if(GS.moving){ const t=GS.mvt; pxx=GS.px+(GS.mvx-GS.px)*t; pyy=GS.py+(GS.mvy-GS.py)*t; }
 if(GS.moving&&GS.jump)pyy-=Math.sin(Math.min(1,GS.mvt)*Math.PI)*0.6;
 const frame=GS.moving? (Math.floor(GS.anim/140)%2+1):0;
 // edifici, NPC e giocatore ordinati per profondità (painter's algorithm)
 const dl=[];
 for(const b of (m.bldgs||[])){
  const B=BKINDS[b.kind], bb=b;
  dl.push({base:(b.y+B.h)*TD-1, fn:()=>{
   const img=bldgImg(bb.kind);
   if(imgReady(img))ctx.drawImage(img,bb.x*TD-ox,bb.y*TD-oy,B.w*TD,B.h*TD);
   else for(let yy=0;yy<B.h;yy++)for(let xx=0;xx<B.w;xx++)ctx.drawImage(renderTile(yy<B.h-2?30:9,0),(bb.x+xx)*TD-ox,(bb.y+yy)*TD-oy,TD,TD);
  }});
 }
 for(const n of m.npcs){
  if(!npcActive(n))continue;
  const nn=n;
  dl.push({base:n.y*TD+TD, fn:()=>drawActor(ctx,nn.x*TD-ox,nn.y*TD-oy,nn.dir,0,nn.spr)});
 }
 dl.push({base:pyy*TD+TD+0.5, fn:()=>drawActor(ctx,pxx*TD-ox,pyy*TD-oy,GS.dir,frame,'HERO')});
 dl.sort((a,b)=>a.base-b.base);
 for(const d of dl)d.fn();
}
function box(x,y,w,h,opts){
 const dark=opts&&opts.bg;
 ctx.fillStyle='#485058'; ctx.fillRect(x,y,w,h);
 ctx.fillStyle=dark||'#f8f8f8'; ctx.fillRect(x+2,y+2,w-4,h-4);
 ctx.strokeStyle=dark?'#68788a':'#b0c8e0'; ctx.lineWidth=2;
 ctx.strokeRect(x+4,y+4,w-8,h-8);
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
 ctx.fillStyle='#404850'; ctx.fillRect(x,y,w,10);
 ctx.fillStyle='#f8f8f8'; ctx.fillRect(x+1,y+1,w-2,8);
 ctx.fillStyle='#e8a010'; ctx.font='bold 8px monospace'; ctx.textBaseline='top'; ctx.fillText('HP',x+3,y+1);
 const bx=x+17, bw=w-20;
 ctx.fillStyle='#c8ccd0'; ctx.fillRect(bx,y+2,bw,6);
 const r=Math.max(0,mon.hp)/mon.maxhp;
 ctx.fillStyle=hpColor(r); ctx.fillRect(bx,y+2,bw*r,6);
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
  box(VW-150,8,142,172);
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
 else if(M.kind==='map'){
  box(8,8,VW-16,VH-16);
  txt('MAPPA DI VALMORA'+(GS.badges.length>=3?'   Z: Volo':'   (Volo dalla 3ª medaglia)'),24,16,'#385890',13);
  const mx=24,my=38,msz=250;
  if(MINIMAP){ ctx.imageSmoothingEnabled=false; ctx.drawImage(MINIMAP,mx,my,msz,msz); }
  ctx.strokeStyle='#385890'; ctx.lineWidth=2; ctx.strokeRect(mx,my,msz,msz);
  const sc=msz/WORLD_W;
  TOWNS.forEach((t2,ti)=>{
   const vx=mx+t2.x*sc, vy=my+t2.y*sc;
   ctx.fillStyle=GS.visited[ti]?'#f8f8f8':'#607080';
   ctx.fillRect(vx-2,vy-2,6,6);
   ctx.strokeStyle='#303030'; ctx.lineWidth=1; ctx.strokeRect(vx-2,vy-2,6,6);
  });
  const vis=Object.keys(GS.visited||{0:1}).map(Number).sort((a,b2)=>a-b2);
  const selTi=vis[M.sel%vis.length], st=TOWNS[selTi];
  if(Math.floor(GS.anim/300)%2){ ctx.strokeStyle='#f83030'; ctx.lineWidth=2; ctx.strokeRect(mx+st.x*sc-5,my+st.y*sc-5,12,12); }
  if(GS.map==='world'){ ctx.fillStyle='#f83030'; ctx.fillRect(mx+GS.px*sc-1,my+GS.py*sc-1,4,4); }
  txt(st.n,290,60,'#303030',14);
  wrapText(st.motto||'',26).slice(0,2).forEach((l,i)=>txt(l,290,84+i*14,'#606060',10));
  if(st.gym)txt('Palestra: '+st.gym.leader+' ('+TYPES[st.gym.type].n+')',290,124,'#385890',10);
  if(GS.badges.length>=3&&GS.map==='world')txt('Z: vola qui',290,160,'#c03028',12);
  txt('◀▶ scorri le città visitate',290,VH-46,'#606060',10);
  txt('X: chiudi',290,VH-32,'#606060',10);
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
    txt('PS:'+sp.bs[0]+' ATT:'+sp.bs[1]+' DIF:'+sp.bs[2],220,200,'#303030',12);
    txt('ATSP:'+sp.bs[3]+' DFSP:'+sp.bs[4]+' VEL:'+sp.bs[5],220,218,'#303030',12);
    txt(sp.ev?('Si evolve al liv. '+sp.ev.lv):'Non si evolve',220,238,'#385890',11);
    wrapText(DEXTXT[sp.id]||'',36).slice(0,3).forEach((l,i)=>txt(l,220,258+i*14,'#606060',10));
    txt('Z: ascolta il verso',220,VH-30,'#909090',9);
   } else txt('Catturalo per i dettagli!',220,200,'#909090',12);
  } else txt('???',270,90,'#909090',30);
 }
 else if(M.kind==='party'||M.kind==='swap'){
  // sfondo a scacchi stile GBA
  ctx.fillStyle='#18a068'; ctx.fillRect(0,0,VW,VH);
  ctx.fillStyle='#149058';
  for(let yy=0;yy<VH;yy+=16)for(let xx=(yy%32?16:0);xx<VW;xx+=32)ctx.fillRect(xx,yy,16,16);
  txt(M.kind==='swap'?'Con chi lo scambi?':'SQUADRA',24,12,'#f8f8f8',15);
  GS.party.forEach((mon,i)=>{
   const y=38+i*45, sp=SP(mon.id), sel=(i===M.sel);
   ctx.fillStyle= sel?'#f89038':'#284878'; ctx.fillRect(16,y,VW-32,41);
   ctx.fillStyle= mon.hp>0?'#78b8f0':'#8890a0'; ctx.fillRect(18,y+2,VW-36,37);
   ctx.fillStyle= mon.hp>0?'#4888d8':'#687080'; ctx.fillRect(18,y+15,VW-36,24);
   if(M.kind==='swap'&&i===M.from){ctx.strokeStyle='#f8f048';ctx.lineWidth=3;ctx.strokeRect(17,y+1,VW-34,39);}
   drawMonIcon(ctx,mon.id,24,y+3,36,36);
   txt(sp.n,70,y+4,'#f8f8f8',13);
   txt('L'+mon.lv,190,y+4,'#f8f8f8',12);
   hpBar(70,y+22,150,mon);
   txt(mon.hp+'/'+mon.maxhp,232,y+22,'#f8f8f8',11);
   statusTag(mon,320,y+20);
   if(mon.hp<=0)txt('KO',320,y+4,'#f86048',12);
  });
 }
 else if(M.kind==='partyAct'){
  drawWorldBehind(); box(VW-150,VH-100,142,88);
  ['VEDI','SPOSTA'].forEach((s,i)=>{ if(i===M.sel)txt('▶',VW-142,VH-86+i*24,'#c03028'); txt(s,VW-126,VH-86+i*24); });
 }
 else if(M.kind==='stats'){
  const mon=GS.party[M.monSel], sp=SP(mon.id), pg=M.page||0;
  box(8,8,VW-16,VH-16);
  txt('SCHEDA — pagina '+(pg+1)+'/2   (◀▶ cambia)',24,14,'#385890',11);
  drawMon(ctx,mon.id,40,36,96,96,mon.shiny);
  txt(sp.n+'   Liv.'+mon.lv,40,140,'#303030',15);
  if(mon.shiny)txt('★',20,140,'#e8b820',15);
  let tx=40; for(const t of sp.t){ ctx.fillStyle=TYPES[t].c; ctx.fillRect(tx,162,64,16); txt(TYPES[t].n,tx+4,164,'#fff',11); tx+=70; }
  statusTag(mon,150,140);
  if(pg===0){
   txt('PS  '+mon.hp+'/'+mon.maxhp,40,192);
   hpBar(110,192,110,mon);
   txt('N. '+String(mon.id).padStart(2,'0'),240,36,'#606060',11);
   txt('ABILITÀ',240,58,'#385890',12);
   txt(mon.abil||'—',240,74,'#303030',12);
   wrapText(mon.abil?(ABIL_D[mon.abil]||''):'',34).slice(0,2).forEach((l,i)=>txt(l,240,90+i*13,'#606060',10));
   txt('STRUMENTO',240,124,'#385890',12);
   txt(mon.held?ITEMS[mon.held].n:'Nessuno',240,140,'#303030',12);
   if(mon.held)wrapText(ITEMS[mon.held].d,34).slice(0,2).forEach((l,i)=>txt(l,240,156+i*13,'#606060',10));
   txt('MEMORIE',240,192,'#385890',12);
   wrapText(DEXTXT[mon.id]||'',34).slice(0,3).forEach((l,i)=>txt(l,240,208+i*13,'#606060',10));
   txt('Esp. '+mon.exp+'  (prossimo liv: '+(expForLv(mon.lv+1)-mon.exp)+')',40,222,'#303030',11);
  } else {
   txt('PS  '+mon.hp+'/'+mon.maxhp,40,192);
   txt('ATT '+mon.atk+'  DIF '+mon.def+'  VEL '+mon.spe,40,212,'#303030',12);
   txt('ATSP '+mon.spa+'  DFSP '+mon.spd,40,230,'#303030',12);
   txt('MOSSE',240,36,'#385890',14);
   mon.moves.forEach((mv,i)=>{
    const mo=MOVES[mv.k];
    txt(mo.n,240,58+i*42);
    ctx.fillStyle=TYPES[mo.t].c; ctx.fillRect(240,74+i*42,50,13); txt(TYPES[mo.t].n,243,76+i*42,'#fff',9);
    txt('PP '+mv.pp+'/'+mo.pp,300,74+i*42,'#606060',11);
    txt(mo.p?('Pot. '+mo.p):'Stato',360,74+i*42,'#606060',11);
   });
  }
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
   drawMonIcon(ctx,mon.id,34,y-3,18,18);
   txt(SP(mon.id).n+' L'+mon.lv,56,y,'#303030',12);
  });
  txt('BOX ('+GS.box.length+')',240,40,'#385890',12);
  GS.box.slice(0,12).forEach((mon,i)=>{
   const y=58+i*18;
   if(M.sel===GS.party.length+i)txt('▶',236,y,'#c03028');
   drawMonIcon(ctx,mon.id,250,y-3,18,18);
   txt(SP(mon.id).n+' L'+mon.lv,272,y,'#303030',12);
  });
 }
 else if(M.kind==='yesno'){
  if(battle)drawBattle(); else drawWorldBehind();
  box(100,VH-160,VW-200,84);
  wrapText(M.q,34).slice(0,2).forEach((l,i)=>txt(l,116,VH-146+i*16,'#303030',12));
  ['SÌ','NO'].forEach((o,i)=>{
   if((M.sel||0)===i)txt('▶',150+i*90,VH-104,'#c03028');
   txt(o,166+i*90,VH-104,'#303030',13);
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
 const wm=mkMon(pick,lv);
 if(R()<.12)wm.held='baccaoran';
 startWildMon(wm, routeIdx);
}
function startWildMon(mon, routeIdx){
 GS.dex.seen[mon.id]=1;
 const yi=firstAlive(); if(yi<0)return;
 battle={kind:'wild', foe:mon, you:GS.party[yi], queue:[], phase:'msg', menuSel:0, fightSel:0,
   shake:0, pendingEvo:[], parts:new Set([yi]), intro:800,
   weather:(GS.map==='world')?zoneWeather(GS.px,GS.py):null};
 initHp(battle.you); initHp(mon);
 resetStages(battle.you); resetStages(mon);
 GS.mode='battle'; sfx('super'); playMusic('battle');
 bqa('Un '+SP(mon.id).n+' selvatico'+(mon.shiny?' ✨ CROMATICO ✨':'')+'! (Liv.'+mon.lv+')','sendF',400,()=>cry(mon.id));
 bqa('Vai, '+SP(battle.you.id).n+'!','sendY',400,()=>cry(battle.you.id),()=>{ battle.phase='menu'; });
 if(battle.weather)bq(WEATHER_MSG[battle.weather]);
 onEntry(battle.foe); onEntry(battle.you);
}
function startTrainerBattle(tr){
 const yi=firstAlive();
 if(yi<0){ say('Le tue creature sono esauste! Curale prima di lottare.'); return; }
 const foeParty=tr.party.map(p=>mkMon(p[0],p[1]));
 if(tr.badge!==undefined||tr.elite!==undefined||tr.champion||tr.id==='ombraBoss'){
  for(const f of foeParty){
   if(R()<.5){
    const bt={FUO:'carbone',ACQ:'gocciamistica',ERB:'fogliamagica',ELE:'magnete'}[SP(f.id).t[0]];
    f.held=bt||'fasciafocus';
   }
  }
 }
 battle={kind:'trainer', trainer:tr, foeParty, foeIdx:0, foe:foeParty[0], you:GS.party[yi],
   queue:[], phase:'msg', menuSel:0, fightSel:0, shake:0, pendingEvo:[], parts:new Set([yi]), intro:800,
   double:!!tr.double, weather:(GS.map==='world')?zoneWeather(GS.px,GS.py):null};
 initHp(battle.you); for(const f of foeParty)initHp(f);
 battle.foePotions = (tr.champion||tr.id==='ombraBoss')?3 : tr.elite!==undefined?2 : tr.badge!==undefined?1 : 0;
 battle.aiSwitched=0;
 if(battle.double){
  const yi2=GS.party.findIndex((m,i)=>m.hp>0&&i!==yi);
  if(yi2>=0){ battle.you2=GS.party[yi2]; resetStages(battle.you2); initHp(battle.you2); battle.parts.add(yi2); }
  else battle.double=false;
  if(battle.double&&foeParty[1]){ battle.foe2=foeParty[1]; battle.foeIdx=1; resetStages(battle.foe2); initHp(battle.foe2); GS.dex.seen[battle.foe2.id]=1; }
  else battle.double=false;
  battle.chooseFor=0;
 }
 resetStages(battle.you); resetStages(battle.foe);
 GS.dex.seen[battle.foe.id]=1;
 GS.mode='battle'; sfx('super'); playMusic('battle');
 bq(tr.name+' ti sfida!');
 bqa(tr.name+' manda in campo '+SP(battle.foe.id).n+(battle.double?' e '+SP(battle.foe2.id).n:'')+'!','sendF',400,()=>cry(battle.foe.id));
 bqa('Vai, '+SP(battle.you.id).n+(battle.double?' e '+SP(battle.you2.id).n:'')+'!','sendY',400,()=>cry(battle.you.id),()=>{ battle.phase='menu'; });
 if(battle.weather)bq(WEATHER_MSG[battle.weather]);
 onEntry(battle.foe); onEntry(battle.you);
 if(battle.double){ onEntry(battle.foe2); onEntry(battle.you2); }
}
function initHp(m){ m.dhp=m.hp; m.vhp=m.hp; m.down=false; }
function activeMons(){ const b=battle; return b?[b.you,b.you2,b.foe,b.foe2].filter(Boolean):[]; }
function playerSide(m){ return GS.party.includes(m); }
const WEATHER_MSG={rain:'Piove!',hail:'Grandina!',sand:'Una tempesta di sabbia imperversa!',sun:'La luce del sole è intensa!'};
function zoneWeather(x,y){
 if(typeof ZONE==='undefined'||!ZONE)return null;
 const z=ZONE[y*WORLD_W+x];
 if(z===7||z===8)return 'hail';
 if(z===5||z===6)return 'rain';
 if(z===2)return 'sand';
 const t7=TOWNS[7];
 if(Math.abs(x-t7.x)<=13&&Math.abs(y-t7.y)<=11)return 'hail';
 return null;
}
function onEntry(m){
 if(!battle||!m)return;
 if(m.abil==='Intimidazione'){
  const opps=(playerSide(m)?[battle.foe,battle.foe2]:[battle.you,battle.you2]).filter(x=>x&&x.hp>0);
  for(const o of opps){
   bq(SP(m.id).n+' intimidisce '+SP(o.id).n+'!');
   applyStage(o,'atk',-1,playerSide(o));
  }
 }
}
function berry(m){
 if(m&&m.held==='baccaoran'&&m.hp>0&&m.hp<=m.maxhp/2){
  m.held=null;
  m.hp=Math.min(m.maxhp,m.hp+15);
  bq(SP(m.id).n+' mangia la sua Baccaoran!'); visHp(m);
 }
}
function resetStages(m){ m.stages={atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0}; m.slpTurns=0; m.conf=0; m.flinched=false; }
function bq(txt, fn, after){ battle.queue.push({txt, fn, after, applied:false}); battle.phase='msg'; }
function bqa(txt,type,dur,fn,after){ battle.queue.push({txt,anim:{type,dur},fn,after,applied:false}); battle.phase='msg'; }
function bqanim(type,dur,fn,after){ battle.queue.push({txt:null,anim:{type,dur},fn,after,applied:false}); battle.phase='msg'; }
function bqfx(mt,side){ if(battle.double)return; battle.queue.push({txt:null,anim:{type:'mfx',dur:430,mt,side},applied:false}); }
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
function effSpa(m){ return m.spa*stageMult(m.stages.spa); }
function effSpd(m){ return m.spd*stageMult(m.stages.spd); }
function effSpe(m){ let s=m.spe*stageMult(m.stages.spe); if(m.status==='PAR')s*=.25; if(battle&&battle.weather==='rain'&&m.abil==='Nuotovelox')s*=2; return s; }

function battleMenuBack(){ if(battle)battle.phase='menu'; }

function battleUpdate(dt, ev){
 const b=battle; if(!b)return;
 if(b.intro>0){ b.intro-=dt; if(b.intro<0)b.intro=0; return; }
 // animazione barre PS
 const lerp=(cur,tgt)=>{ const d=tgt-cur; if(Math.abs(d)<.5)return tgt; return cur+d*Math.min(1,dt/180); };
 for(const m of activeMons()){ if(m.dhp===undefined)initHp(m); m.dhp=lerp(m.dhp,Math.max(0,m.vhp)); }
 if(b.shake>0)b.shake-=dt;
 if(b.banim)b.banim.t+=dt;
 if(b.phase==='msg'){
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
   if(!cur.applied){ cur.applied=true; if(cur.fn)cur.fn(); if(cur.anim)b.banim=Object.assign({t:0},cur.anim); }
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
   if(b.menuSel===0){ b.phase='fight'; if(b.double)b.chooseFor=0; }
   else if(b.menuSel===1){ menuState={kind:'bag',sel:0,ctx:'battle'}; GS.mode='menu'; }
   else if(b.menuSel===2){
    if(b.double)bq('Nelle lotte in coppia i rimpiazzi sono automatici!');
    else { menuState={kind:'party',sel:0,ctx:'switch'}; GS.mode='menu'; }
   }
   else tryRun();
  }
  return;
 }
 if(b.phase==='fight'){
  const actor=(b.double&&b.chooseFor===1)?b.you2:b.you;
  const n=actor.moves.length;
  if(ev==='U'&&b.fightSel>=2){b.fightSel-=2;sfx('menu');}
  else if(ev==='D'&&b.fightSel+2<n){b.fightSel+=2;sfx('menu');}
  else if(ev==='L'&&b.fightSel%2===1){b.fightSel--;sfx('menu');}
  else if(ev==='R'&&b.fightSel%2===0&&b.fightSel+1<n){b.fightSel++;sfx('menu');}
  else if(ev==='B'){ if(b.double&&b.chooseFor===1){b.chooseFor=0;b.fightSel=0;} else {b.phase='menu';} sfx('b'); }
  else if(ev==='A'){
   const mv=actor.moves[b.fightSel];
   if(mv.pp<=0){ sfx('b'); return; }
   sfx('a');
   if(b.double){
    if(b.chooseFor===0){
     b.act1={user:b.you,mv};
     if(b.you2&&b.you2.hp>0){ b.chooseFor=1; b.fightSel=0; return; }
     playTurnDouble(b.act1,null);
    } else {
     playTurnDouble(b.act1,{user:b.you2,mv});
     b.chooseFor=0;
    }
   } else playTurn(mv);
  }
  return;
 }
}
function tryRun(){
 const b=battle;
 if(b.kind==='trainer'){ bq('Non puoi fuggire da una lotta tra allenatori!'); return; }
 if(b.you.abil==='Fugafacile'){ sfx('run'); bq('Fuga garantita! (Fugafacile)', null, endBattleCleanup); return; }
 const chance=Math.min(.95,.5+ (effSpe(b.you)-effSpe(b.foe))/200 + .2);
 if(R()<chance){ sfx('run'); bq('Fuga riuscita!', null, endBattleCleanup); }
 else { bq('Non riesci a fuggire!', null, ()=>{ foeTurnOnly(); }); }
}
function battleItemUsed(){ GS.mode='battle'; foeTurnOnly(); }
function doSwitch(idx){
 const b=battle;
 menuState=null; GS.mode='battle';
 if(b.parts)b.parts.add(idx);
 if(b.freeSwitch){
  b.freeSwitch=false;
  b.you=GS.party[idx]; resetStages(b.you); initHp(b.you);
  bqa('Vai, '+SP(b.you.id).n+'!','sendY',400,()=>{ if(b.you){b.you.down=false;} onEntry(b.you); });
  sendNextFoe();
  return;
 }
 if(b.forceSwitch){
  b.forceSwitch=false;
  b.you=GS.party[idx]; resetStages(b.you); initHp(b.you);
  bqa('Vai, '+SP(b.you.id).n+'!','sendY',400,()=>{ if(b.you){b.you.down=false;} onEntry(b.you); },()=>{ b.phase='menu'; });
 } else {
  bq(SP(b.you.id).n+', torna indietro!');
  b.you=GS.party[idx]; resetStages(b.you); initHp(b.you);
  bqa('Vai, '+SP(b.you.id).n+'!','sendY',400,()=>{ if(b.you){b.you.down=false;} onEntry(b.you); });
  foeTurnOnly();
 }
}
function foeTurnOnly(){
 const b=battle;
 if(b.double){ playTurnDouble(null,null); return; }
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
function pickFoeMoveFor(f){
 const usable=f.moves.filter(m=>m.pp>0);
 if(!usable.length)return {k:'azione',pp:1};
 let best=null,score=-1;
 for(const m of usable){
  const mo=MOVES[m.k];
  let v=R()*20+(mo.p||0);
  if(v>score){score=v;best=m;}
 }
 return best;
}
function pickTargetFor(user){
 const b=battle;
 const opp=playerSide(user)?[b.foe,b.foe2]:[b.you,b.you2];
 const alive=opp.filter(m=>m&&m.hp>0);
 if(!alive.length)return null;
 return alive[Math.floor(R()*alive.length)];
}
function playTurnDouble(a1,a2){
 const b=battle;
 const acts=[];
 if(a1&&a1.user.hp>0)acts.push(a1);
 if(a2&&a2.user.hp>0)acts.push(a2);
 for(const f of [b.foe,b.foe2])if(f&&f.hp>0)acts.push({user:f,mv:pickFoeMoveFor(f)});
 acts.sort((x,y)=>{
  const px=MOVES[x.mv.k].pr||0, py=MOVES[y.mv.k].pr||0;
  if(px!==py)return py-px;
  return effSpe(y.user)-effSpe(x.user);
 });
 for(const a of acts){
  if(a.user.hp<=0)continue;
  const tgt=pickTargetFor(a.user);
  if(!tgt)break;
  execMove(a.user,tgt,a.mv,playerSide(a.user));
 }
 endTurnStatus();
}
function foeSmartAction(){
 const b=battle;
 if(b.kind!=='trainer'||b.double)return false;
 if(b.foePotions>0&&b.foe.hp>0&&b.foe.hp<=b.foe.maxhp*0.3){
  b.foePotions--;
  b.foe.hp=Math.min(b.foe.maxhp,b.foe.hp+60);
  bq(b.trainer.name+' usa una Superpozione su '+SP(b.foe.id).n+'!',()=>sfx('heal'));
  visHp(b.foe);
  return true;
 }
 if((b.aiSwitched||0)<2){
  const effBest=m=>Math.max(0,...m.moves.map(v=>{const mo=MOVES[v.k];return mo.p>0?typeMult(mo.t,SP(b.you.id).t):0;}));
  if(effBest(b.foe)<=0.5){
   const ci=b.foeParty.findIndex((x,i)=>i>b.foeIdx&&x.hp>0&&effBest(x)>=1);
   if(ci>0){
    const cand=b.foeParty[ci];
    b.foeParty[ci]=b.foeParty[b.foeIdx];
    b.foeParty[b.foeIdx]=cand;
    b.aiSwitched=(b.aiSwitched||0)+1;
    bq(b.trainer.name+' richiama '+SP(b.foe.id).n+'!');
    b.foe=cand;
    resetStages(b.foe); initHp(b.foe);
    GS.dex.seen[b.foe.id]=1;
    bqa(b.trainer.name+' manda in campo '+SP(b.foe.id).n+'!','sendF',400,()=>{ b.foe.down=false; cry(b.foe.id); onEntry(b.foe); });
    return true;
   }
  }
 }
 return false;
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
  if(b.foe.hp>0&&b.you.hp>0){ if(!foeSmartAction())execMove(b.foe,b.you,foeMv,false); }
 } else {
  if(!foeSmartAction())execMove(b.foe,b.you,foeMv,false);
  execMoveIfAlive(b.you,b.foe,yourMv,true);
 }
 endTurnStatus();
}
function execMoveIfAlive(user,tgt,mv,isYou){
 if(user.hp>0&&tgt.hp>0)execMove(user,tgt,mv,isYou);
}
// aggiorna la barra PS "visiva" del lato giusto quando il messaggio scorre
function visHp(m){
 const v=Math.max(0,m.hp);
 bqv(()=>{ m.vhp=v; });
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
 if(user.flinched){ user.flinched=false; bq(tag+un+' si è impaurito e non riesce a muoversi!'); return; }
 if(user.conf&&user.conf>0){
  user.conf--;
  if(user.conf<=0){ bq(tag+un+' non è più confuso!'); }
  else {
   bq(tag+un+' è confuso!');
   if(R()<.5){
    const cd=Math.max(1,Math.floor(Math.floor((2*user.lv/5+2)*40*effAtk(user)/Math.max(1,effDef(user))/50)+2));
    user.hp=Math.max(0,user.hp-cd);
    bq('Si colpisce da solo per la confusione!');
    bqv(()=>{ battle.shake=250; battle.shakeTgt=isYou?'you':'foe'; sfx('hit'); });
    visHp(user);
    if(user.hp<=0)handleFaint(user,!isYou);
    return;
   }
  }
 }
 if(user.status==='PAR'&&R()<.25){ bq(tag+un+' è paralizzato! Non si muove!'); return; }
 mv.pp=Math.max(0,mv.pp-1);
 bq(tag+un+' usa '+mo.n+'!');
 bqanim(isYou?'lungeY':'lungeF',240);
 // precisione (con stadi di precisione/elusione)
 if(mo.a>0){
  const accS=(user.stages.acc||0)-(tgt.stages.eva||0);
  const accM= accS>=0? (3+accS)/3 : 3/(3-accS);
  if(R()*100>mo.a*accM){ bq('...ma fallisce!'); return; }
 }
 if(mo.p>0){
  bqfx(mo.t,isYou?'foe':'you');
  const hits=mo.hits||1;
  let landed=0;
  for(let h=0;h<hits;h++){
   if(tgt.hp<=0)break;
   if(mo.t==='TER'&&tgt.abil==='Levitazione'){ bq(tn+' fluttua: nessun effetto! (Levitazione)'); break; }
   if(mo.t==='ACQ'&&tgt.abil==='Assorbacqua'){ tgt.hp=Math.min(tgt.maxhp,tgt.hp+Math.max(1,Math.floor(tgt.maxhp/4))); bq(tn+' assorbe l\'acqua e recupera PS! (Assorbacqua)'); visHp(tgt); break; }
   if(mo.t==='ELE'&&tgt.abil==='Assorbivolt'){ tgt.hp=Math.min(tgt.maxhp,tgt.hp+Math.max(1,Math.floor(tgt.maxhp/4))); bq(tn+' assorbe la scarica e recupera PS! (Assorbivolt)'); visHp(tgt); break; }
   const eff=typeMult(mo.t,SP(tgt.id).t);
   if(eff===0){ bq('Non ha alcun effetto su '+tn+'...'); break; }
   const crit=R()<(mo.hc?1/8:1/16);
   const stab=SP(user.id).t.includes(mo.t)?1.5:1;
   const specialMove=SPECIAL_TYPES.has(mo.t);
   const A=specialMove?effSpa(user):effAtk(user);
   const D=specialMove?effSpd(tgt):effDef(tgt);
   let dmg=Math.floor(Math.floor((2*user.lv/5+2)*mo.p*A/Math.max(1,D)/50)+2);
   dmg=Math.floor(dmg*stab*eff*(crit?2:1)*(217+Math.floor(R()*39))/255);
   if((user.abil==='Erbaiuto'&&mo.t==='ERB'||user.abil==='Aiutofuoco'&&mo.t==='FUO'||user.abil==='Idroaiuto'&&mo.t==='ACQ')&&user.hp<=user.maxhp/3)dmg=Math.floor(dmg*1.5);
   if(user.held&&HOLD_BOOST[user.held]===mo.t)dmg=Math.floor(dmg*1.1);
   if(b.weather==='rain'){ if(mo.t==='ACQ')dmg=Math.floor(dmg*1.5); else if(mo.t==='FUO')dmg=Math.floor(dmg*0.5); }
   else if(b.weather==='sun'){ if(mo.t==='FUO')dmg=Math.floor(dmg*1.5); else if(mo.t==='ACQ')dmg=Math.floor(dmg*0.5); }
   dmg=Math.max(1,dmg);
   if(dmg>=tgt.hp&&tgt.abil==='Robustezza'&&tgt.hp===tgt.maxhp&&tgt.hp>1){ dmg=tgt.hp-1; bq(tn+' resiste con Robustezza!'); }
   else if(dmg>=tgt.hp&&tgt.held==='fasciafocus'&&tgt.hp>1&&R()<.1){ dmg=tgt.hp-1; bq(tn+' resiste grazie alla Fascia Focus!'); }
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
   if(!specialMove&&applied>0&&user.hp>0&&!user.status){
    const ret={Corpodifuoco:'BRN',Velenopunto:'PSN',Statico:'PAR'}[tgt.abil];
    if(ret&&R()<.3)applyStatus(user,ret,!isYou);
   }
   berry(tgt);
  }
  if(hits>1&&landed>1)bq('Colpito '+landed+' volte!');
  // effetti secondari: flinch e confusione
  if(mo.fl&&landed>0&&tgt.hp>0&&R()<mo.fl)tgt.flinched=true;
  if(mo.fx&&mo.fx.cf&&tgt.hp>0&&R()<mo.fx.cf&&!tgt.conf){
   tgt.conf=2+Math.floor(R()*3);
   bq((isYou?'Il nemico ':'')+tn+' è confuso!');
  }
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
const STAT_N={atk:'Attacco',def:'Difesa',spa:'Att. Speciale',spd:'Dif. Speciale',spe:'Velocità',acc:'Precisione',eva:'Elusione'};
const ST_MSG={PSN:'è avvelenato!',PAR:'è paralizzato!',SLP:'si addormenta!',BRN:'è scottato!',FRZ:'è congelato!'};
function applyStatus(m,st,isFoe){
 if(st==='SLP'&&m.abil==='Insonnia'){ bq(SP(m.id).n+' non può addormentarsi! (Insonnia)'); return; }
 m.status=st;
 if(st==='SLP')m.slpTurns=ri(1,3);
 bq((isFoe?'Il nemico ':'')+SP(m.id).n+' '+ST_MSG[st]);
 if(m.held==='baccacura'){ m.held=null; m.status=null; bq(SP(m.id).n+' si cura con la Baccacura!'); }
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
 for(const m of activeMons())m.flinched=false;
 for(const m of activeMons()){
  if(m.hp<=0)continue;
  const isYou=playerSide(m);
  if(m.status==='PSN'||m.status==='BRN'){
   const chip=Math.max(1,Math.floor(m.maxhp/(m.status==='PSN'?8:16)));
   m.hp=Math.max(0,m.hp-chip);
   bq((isYou?'':'Il nemico ')+SP(m.id).n+(m.status==='PSN'?' soffre per il veleno!':' soffre per la scottatura!'),()=>sfx('hit'));
   visHp(m); berry(m);
   if(m.hp<=0)handleFaint(m,!isYou);
  }
 }
 if(b.weather==='hail'||b.weather==='sand'){
  for(const m of activeMons()){
   if(m.hp<=0)continue;
   const tt=SP(m.id).t;
   const immune= b.weather==='hail' ? tt.includes('GHI') : (tt.includes('ROC')||tt.includes('TER'));
   if(immune)continue;
   const chip=Math.max(1,Math.floor(m.maxhp/16));
   m.hp=Math.max(0,m.hp-chip);
   bq((playerSide(m)?'':'Il nemico ')+SP(m.id).n+(b.weather==='hail'?' è colpito dalla grandine!':' è sferzato dalla sabbia!'),()=>sfx('hit'));
   visHp(m); berry(m);
   if(m.hp<=0)handleFaint(m,!playerSide(m));
  }
 }
}
function handleFaint(m,wasTargetOfYou){
 const b=battle;
 if(m.faintQueued)return;
 m.faintQueued=true;
 const isFoeMon = (m===b.foe)|| (b.foeParty&&b.foeParty.includes(m));
 bqanim(isFoeMon?'faintF':'faintY',450,()=>{sfx('faint');cry(m.id,true);},()=>{ m.down=true; });
 bq((isFoeMon?'Il nemico ':'')+SP(m.id).n+' è esausto!');
 if(isFoeMon)foeFainted(m); else youFainted(m);
}
function foeFainted(fm){
 const b=battle;
 fm=fm||b.foe;
 // esperienza divisa tra i partecipanti ancora in forze
 const sp=SP(fm.id);
 const total=Math.max(1,Math.floor(sp.bx*fm.lv/7*(b.kind==='trainer'?1.5:1)));
 let list=[...(b.parts||[])].map(i=>GS.party[i]).filter(m=>m&&m.hp>0);
 if(!list.length)list=[b.you];
 const each=Math.max(1,Math.floor(total/list.length));
 for(const mon of list){
  mon.exp+=each;
  bq(SP(mon.id).n+' guadagna '+each+' Esp.!');
  checkLevelUps(mon);
 }
 afterFoeFaint(fm);
}
function sendNextFoe(){
 const b=battle; if(!b)return;
 b.foeIdx++;
 b.foe=b.foeParty[b.foeIdx];
 resetStages(b.foe);
 GS.dex.seen[b.foe.id]=1;
 b.parts=new Set([GS.party.indexOf(b.you)]);
 bqa(b.trainer.name+' manda in campo '+SP(b.foe.id).n+'!','sendF',400,()=>{ initHp(b.foe); b.foeHidden=false; cry(b.foe.id); onEntry(b.foe); },()=>{ b.phase='menu'; });
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
function trainerVictory(){
 const b=battle, tr=b.trainer;
 bq('Hai sconfitto '+tr.name+'!',()=>sfx('victory'));
 bq(tr.name+': "'+tr.l+'"');
 bq('Ricevi '+tr.money+'¤!',()=>{
  GS.money+=tr.money; GS.defeated[tr.id]=1;
  if(GS.defeated['ombra1a']||GS.defeated['ombra1b']){GS.defeated['ombra1a']=1;GS.defeated['ombra1b']=1;GS.flags.ombra1=true;}
  if(GS.defeated['ombraBoss'])GS.flags.teamDone=true;
 });
 if(tr.badge!==undefined){
  bq('Ottieni la '+tr.badgeName+'!',()=>{ if(!GS.badges.includes(tr.badge))GS.badges.push(tr.badge); sfx('badge'); });
 }
 if(tr.champion){
  bq('Congratulazioni! Sei il nuovo CAMPIONE DI VALMORA!',()=>{ GS.flags.champion=true; sfx('badge'); });
  bq('Il Prof. Cedro sarebbe fiero di te. Grazie per aver giocato!');
 }
 bq('',null,endBattleVictory);
}
function afterFoeFaint(fm){
 const b=battle;
 fm=fm||b.foe;
 if(b.double){
  const nxt=b.foeParty.slice(b.foeIdx+1).find(x=>x.hp>0);
  if(nxt){
   b.foeIdx=b.foeParty.indexOf(nxt);
   if(fm===b.foe)b.foe=nxt; else b.foe2=nxt;
   resetStages(nxt); initHp(nxt); GS.dex.seen[nxt.id]=1;
   bqa(b.trainer.name+' manda in campo '+SP(nxt.id).n+'!','sendF',400,()=>{ nxt.down=false; b.foeHidden=false; cry(nxt.id); onEntry(nxt); });
  } else {
   const anyAlive=[b.foe,b.foe2].some(x=>x&&x.hp>0);
   if(!anyAlive)trainerVictory();
  }
  return;
 }
 if(b.kind==='trainer'&&b.foeIdx<b.foeParty.length-1){
  const nxt=SP(b.foeParty[b.foeIdx+1].id).n;
  const alive=GS.party.filter(m=>m.hp>0).length;
  if(alive>1){
   bq(b.trainer.name+' sta per mandare in campo '+nxt+'.',null,()=>{
    menuState={kind:'yesno',sel:0,q:'Vuoi cambiare creatura?',
     yes:()=>{ battle.freeSwitch=true; menuState={kind:'party',sel:0,ctx:'switch'}; },
     no:()=>{ GS.mode='battle'; sendNextFoe(); }};
    GS.mode='menu';
   });
  } else {
   bq(b.trainer.name+' sta per mandare in campo '+nxt+'.',null,sendNextFoe);
  }
 } else if(b.kind==='trainer'){
  trainerVictory();
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
  mon.id=to.id; mon.abil=ABIL[to.id]||null; recalcStats(mon); mon.hp=Math.max(1,Math.floor(mon.maxhp*ratio));
  GS.dex.seen[to.id]=1; GS.dex.caught[to.id]=1;
  sfx('evolve');
  say(sp.n+' si è evoluto in '+to.n+'!', ()=>runEvolutions(evos));
 });
}
function youFainted(m){
 const b=battle;
 if(b.double){
  const activi=[b.you,b.you2].filter(Boolean);
  const bi=GS.party.findIndex(x=>x.hp>0&&!activi.includes(x));
  const send=(slot2)=>{
   const nx=GS.party[bi];
   if(slot2)b.you2=nx; else b.you=nx;
   resetStages(nx); initHp(nx); b.parts.add(bi);
   bqa('Vai, '+SP(nx.id).n+'!','sendY',400,()=>{ nx.down=false; cry(nx.id); onEntry(nx); });
  };
  if(m===b.you2){
   if(bi>=0)send(true); else b.you2=null;
  } else {
   if(bi>=0)send(false);
   else if(b.you2&&b.you2.hp>0){ b.you=b.you2; b.you2=null; }
   else { blackout(); return; }
  }
  return;
 }
 const alive=GS.party.filter(x=>x.hp>0).length;
 if(alive>0){
  bq('Scegli la prossima creatura!',null,()=>{
   b.forceSwitch=true;
   menuState={kind:'party',sel:0,ctx:'switch',force:true};
   GS.mode='menu';
  });
 } else { blackout(); }
}
function blackout(){
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
function endBattleCleanup(){ battle=null; if(GS.mode==='battle')GS.mode='world'; updateWorldMusic(); }

function throwBall(k){
 const b=battle;
 menuState=null; GS.mode='battle';
 if(b.kind==='trainer'){ bq('Non puoi catturare le creature degli allenatori!',null,()=>{ b.phase='menu'; }); return; }
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
  m.stages={atk:0,def:0,spa:0,spd:0,spe:0,acc:0,eva:0}; m.faintQueued=false;
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
 if(b.double){
  const slots=[[b.foe,296,42,92],[b.foe2,376,16,76],[b.you,30,122,128],[b.you2,170,98,100]];
  for(const q of slots){
   const m=q[0]; if(!m||m.down)continue;
   if((m.hp<=0)&&((m.dhp??0)<=0.5))continue;
   if(playerSide(m))drawMonBack(ctx,m.id,q[1],q[2],q[3],q[3],m.shiny);
   else drawMon(ctx,m.id,q[1],q[2],q[3],q[3],m.shiny);
  }
  box(10,10,206,66);
  [[b.foe,0],[b.foe2,1]].forEach(q=>{ const m=q[0]; if(!m)return; const y=17+q[1]*26;
   txt(SP(m.id).n,20,y,'#303030',11); txt('L'+m.lv,126,y,'#303030',10);
   hpBar(20,y+11,102,{hp:m.dhp??m.hp,maxhp:m.maxhp}); statusTag(m,152,y+8); });
  box(VW-220,VH-148,210,66);
  [[b.you,0],[b.you2,1]].forEach(q=>{ const m=q[0]; if(!m)return; const y=VH-141+q[1]*26;
   txt(SP(m.id).n,VW-210,y,'#303030',11); txt('L'+m.lv,VW-104,y,'#303030',10);
   hpBar(VW-210,y+11,102,{hp:m.dhp??m.hp,maxhp:m.maxhp}); statusTag(m,VW-78,y+8); });
 } else {
 const sh=b.shake>0? (R()*6-3):0;
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
 const fshow=!(b.foe.down||b.foeHidden)&&(b.foe.hp>0||(b.foe.dhp??0)>0.5||A);
 if(fshow&&!(blink&&b.shakeTgt==='foe')){ ctx.globalAlpha=fa; drawMon(ctx,b.foe.id,fx,fy,fw,fh,b.foe.shiny); ctx.globalAlpha=1; }
 const yshow=!b.you.down&&(b.you.hp>0||(b.you.dhp??0)>0.5||A);
 if(yshow&&!(blink&&b.shakeTgt==='you')){ ctx.globalAlpha=ya; drawMonBack(ctx,b.you.id,yx,yy,yw,yh,b.you.shiny); ctx.globalAlpha=1; }
 if(burst>0){ ctx.globalAlpha=1-burst; ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(350,105,20+burst*70,0,7); ctx.fill(); ctx.globalAlpha=1; }
 if(ball)drawBall(ctx,ball.x,ball.y,12,ball.tilt||0);
 if(A&&A.type==='mfx')drawMoveFx(A);
 if(stars>0){ ctx.globalAlpha=Math.min(1,stars*1.5); ctx.fillStyle='#f8d030'; ctx.font='bold '+(12+stars*6)+'px monospace'; ctx.textBaseline='top';
  ctx.fillText('★',322,104-stars*26); ctx.fillText('★',346,96-stars*32); ctx.fillText('★',372,104-stars*26); ctx.globalAlpha=1; }
 // box info nemico
 box(14,14,190,58);
 txt(SP(b.foe.id).n,24,22,'#303030',13);
 if(b.foe.shiny)txt('★',150,22,'#e8b820',12);
 txt('L'+b.foe.lv,160,22,'#303030',12);
 const fmon={hp:b.foe.dhp??b.foe.hp,maxhp:b.foe.maxhp};
 hpBar(24,42,150,fmon);
 statusTag(b.foe,24,54);
 // box info tuo
 box(VW-210,VH-146,196,70);
 txt(SP(b.you.id).n,VW-198,VH-138,'#303030',13);
 if(b.you.shiny)txt('★',VW-70,VH-138,'#e8b820',12);
 txt('L'+b.you.lv,VW-50,VH-138,'#303030',12);
 const ymon={hp:b.you.dhp??b.you.hp,maxhp:b.you.maxhp};
 hpBar(VW-198,VH-118,150,ymon);
 txt(Math.ceil(Math.max(0,b.you.dhp??b.you.hp))+'/'+b.you.maxhp,VW-198,VH-104,'#303030',11);
 statusTag(b.you,VW-90,VH-106);
 // barra esperienza
 const need=expForLv(b.you.lv+1)-expForLv(b.you.lv);
 const have=b.you.exp-expForLv(b.you.lv);
 ctx.fillStyle='#585858'; ctx.fillRect(VW-198,VH-88,150,5);
 ctx.fillStyle='#40a0f8'; ctx.fillRect(VW-197,VH-87,148*Math.max(0,Math.min(1,have/need)),3);
 }
 if(b.weather)drawWeatherFx(b.weather);
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
  const actorD=(b.double&&b.chooseFor===1)?b.you2:b.you;
  if(b.double)txt('Mosse di '+SP(actorD.id).n+':',24,VH-66,'#385890',9);
  actorD.moves.forEach((mv,i)=>{
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
 if(TITLEIMG.ok){
  // splash a schermo intero (ritaglio centrale, proporzioni preservate)
  const img=TITLEIMG.img;
  const sc=Math.max(VW/img.width,VH/img.height);
  const w=img.width*sc, h=img.height*sc;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,(VW-w)/2,(VH-h)/2,w,h);
  ctx.fillStyle='rgba(8,16,32,.55)'; ctx.fillRect(0,VH-92,VW,92);
 } else {
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
 }
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
 updateWorldMusic();
 if(hasSave&&titleSel===1){ if(loadGame()){ GS.mode='world'; fadeIn(); return; } }
 newGame();
}
function newGame(){
 GS.mode='world'; GS.map='world';
 GS.px=TOWNS[0].x; GS.py=TOWNS[0].y+1; GS.dir=2;
 GS.party=[]; GS.box=[]; GS.bag={sfera:5,pozione:3}; GS.money=3000;
 GS.badges=[]; GS.defeated={}; GS.flags={}; GS.dex={seen:{},caught:{}};
 GS.lastHeal={map:'world',x:TOWNS[0].x,y:TOWNS[0].y+1};
 GS.visited={0:1};
 say('Benvenuto nella regione di VALMORA! Il laboratorio del Prof. Cedro è l\'edificio col tetto viola, qui a sud. Va\' a trovarlo: ha un regalo per te!');
}
const SAVE_KEY='valmora_save_v1';
function saveData(){
 return JSON.stringify({
  map:GS.map,px:GS.px,py:GS.py,dir:GS.dir,party:GS.party,box:GS.box,bag:GS.bag,
  money:GS.money,badges:GS.badges,defeated:GS.defeated,flags:GS.flags,dex:GS.dex,
  lastHeal:GS.lastHeal,name:GS.name,steps:GS.steps,visited:GS.visited
 });
}
function saveGame(){
 try{ localStorage.setItem(SAVE_KEY,saveData()); hasSave=true; }catch(e){}
}
function applySave(d){
 GS.map=d.map;GS.px=d.px;GS.py=d.py;GS.dir=d.dir||2;
 GS.party=d.party||[];GS.box=d.box||[];GS.bag=d.bag||{};GS.money=d.money||0;
 GS.badges=d.badges||[];GS.defeated=d.defeated||{};GS.flags=d.flags||{};
 GS.dex=d.dex||{seen:{},caught:{}};GS.lastHeal=d.lastHeal;GS.name=d.name||'ALEX';GS.steps=d.steps||0;GS.visited=d.visited||{0:1};
 GS.moving=false; battle=null; menuState=null; dialogQ=null;
 // se la mappa è cambiata e il giocatore è dentro un ostacolo, torna all'ultimo Centro
 const cm=MAPS[GS.map]||MAPS.world;
 if(SOLID.has(G(cm,GS.px,GS.py))){
  const lh=GS.lastHeal||{map:'world',x:TOWNS[0].x,y:TOWNS[0].y+1};
  GS.map=lh.map; GS.px=lh.x; GS.py=lh.y;
 }
 // ricalcola i derivati per sicurezza
 for(const m of [...GS.party,...GS.box]){ const hp=m.hp; recalcStats(m); m.hp=Math.min(hp,m.maxhp); m.abil=ABIL[m.id]||null; }
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
 buildMinimap();
 preloadSprites();
 playMusic('title');
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
  if(sp.bs.length!==6)errs.push(sp.n+': statistiche mancanti');
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
  // raggiungibilità del mondo (gli NPC non devono bloccare i percorsi)
  {
   const flood=(ignoreGuard)=>{
    const nb=new Set();
    for(const n of w.npcs){ if(!(ignoreGuard&&n.guard))nb.add(n.x+','+n.y); }
    const seen=new Uint8Array(w.w*w.h);
    const q=[[TOWNS[0].x,TOWNS[0].y+1]];
    seen[(TOWNS[0].y+1)*w.w+TOWNS[0].x]=1;
    while(q.length){
     const [x,y]=q.pop();
     for(const d of [[0,1],[0,-1],[1,0],[-1,0]]){
      const nx=x+d[0], ny=y+d[1];
      if(nx<0||ny<0||nx>=w.w||ny>=w.h)continue;
      const idx=ny*w.w+nx;
      if(seen[idx])continue;
      if(SOLID.has(w.t[idx]))continue;
      if(nb.has(nx+','+ny))continue;
      seen[idx]=1; q.push([nx,ny]);
     }
    }
    return seen;
   };
   const s1=flood(false), s2=flood(true);
   for(let ti=0;ti<9;ti++){ const t=TOWNS[ti]; if(!s1[(t.y+1)*w.w+t.x])errs.push('Città bloccata da NPC/ostacoli: '+t.n); }
   const lg=TOWNS[9];
   if(!s2[(lg.y+1)*w.w+lg.x])errs.push('Lega non raggiungibile nemmeno senza guardia');
   if(s1[(lg.y+1)*w.w+lg.x])errs.push('La guardia della Lega si può aggirare!');
   for(const key in w.warps){ const xy=key.split(','); const x=+xy[0], y=+xy[1]; if(!s2[(y+1)*w.w+x])errs.push('Porta non raggiungibile: '+key); }
   for(const n of w.npcs){ if(SOLID.has(G(w,n.x,n.y)))errs.push('NPC su ostacolo: '+n.x+','+n.y); }
  }
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
