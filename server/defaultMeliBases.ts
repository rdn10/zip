import fs from 'fs';
import path from 'path';

export interface MeliHubRaw {
  name: string;
  state: string;
  codes: string[];
  address: string;
  restrictions?: string;
  cnpj?: string;
}

export const MELI_HUBS: MeliHubRaw[] = [
  // Page 1
  {
    name: "LOUVEIRA",
    state: "SP",
    codes: ["BRSP01"],
    address: "R. Wagner Luiz Bevilacqua, 525 - Parque dos Estados, Louveira - SP, 13290-000",
    cnpj: "20.121.850/0003-17 / 03.007.331/0076-69"
  },
  {
    name: "CAJAMAR (I)",
    state: "SP",
    codes: ["BRSP02"],
    address: "Av. Dr. Antonio João Abdalla, 3333 - Centro, Cajamar - SP, 07750-620",
    cnpj: "20.121.850/0009-02 / 03.007.331/0079-01"
  },
  {
    name: "CAJAMAR (II)",
    state: "SP",
    codes: ["BRSP03"],
    address: "Cajamar DCC, SP, 07750-000",
    cnpj: "20.121.850/0054-67 / 03.007.331/0013-85"
  },
  {
    name: "CAJAMAR",
    state: "SP",
    codes: ["BRSP04", "BRSP14"],
    address: "Avenida Antonio Candido Machado, 3100, Cajamar - SP",
    cnpj: "20.121.850/0079-15 / 03.007.331/0074-05"
  },
  {
    name: "FRANCO DA ROCHA (BULKY)",
    state: "SP",
    codes: ["BRSP05", "SSP32", "BRSP10"],
    address: "Rod. Pres. Tancredo de Almeida Neves, 7908 - Jardim Santa Gertrudes, Franco da Rocha - SP, 13205-005",
    cnpj: "20.121.850/0093-73 / 03.007.331/0114-29"
  },
  {
    name: "ARAÇARIGUAMA",
    state: "SP",
    codes: ["BRSP06"],
    address: "Rod. Pres. Castello Branco, Km 46 - Prologis, Araçariguama - SP, 18147-000",
    restrictions: "SEM RESTRIÇÃO",
    cnpj: "03.007.331/0014-66"
  },
  {
    name: "LAURO DE FREITAS",
    state: "BA",
    codes: ["BRBA01"],
    address: "Via Parafuso, 51 - Areia Branca, Lauro de Freitas - BA, 42700-000",
    cnpj: "20.121.850/0020-18 / 03.007.331/0097-93"
  },
  {
    name: "SIMÕES FILHO",
    state: "BA",
    codes: ["BRBA02"],
    address: "Rodovia BA-093, km 4,5 Zona Rural Simões Filho - BA, 48760-000"
  },
  {
    name: "EXTREMA",
    state: "MG",
    codes: ["BRMG01"],
    address: "Estr. Mun. Vargem do João Pinto 450, Extrema - MG, 37640-000",
    cnpj: "20.121.850/0029-56 / 03.007.331/0137-15"
  },
  {
    name: "GOVERNADOR CELSO RAMOS (CD)",
    state: "SC",
    codes: ["BRSC02"],
    address: "CD Mercado Livre - Av. Papenborg, 2400 - Guaporanga, Gov. Celso Ramos - SC, 88190-000",
    cnpj: "20.121.850/0108-94 / 03.007.331/0120-77"
  },
  {
    name: "GOVERNADOR CELSO RAMOS (CROSS)",
    state: "SC",
    codes: ["BRXSC2", "SSC9"],
    address: "GCR Business Park -, Gov. Celso Ramos SC BR-101 , 88190-000",
    cnpj: "03.007.331/0144-44"
  },
  {
    name: "SÃO PAULO (RECEIVER CENTER ANHANGUERA)",
    state: "SP",
    codes: ["BRRC01"],
    address: "Rua Pista Lateral, 127 - Anhanguera, São Paulo - SP, 05276-950",
    cnpj: "20.121.850/0122-42 / 03.007.331/0024-38"
  },
  {
    name: "SUMARÉ (NOVA VENEZA)",
    state: "SP",
    codes: ["BRRC02"],
    address: "Rod. Adauto Campo Dall'Orto, 1 - Nova Veneza, Sumaré - SP, 13178-440"
  },
  {
    name: "CAJAMAR (SYSLOG)",
    state: "SP",
    codes: ["BRSP09", "BRSP15"],
    address: "Av. Ribeirão dos Cristais, 2170 - Vila Nova, Cajamar - SP, 07750-000"
  },
  {
    name: "GUARULHOS (BRICKLOG)",
    state: "SP",
    codes: ["BRSP19", "BRSP18"],
    address: "Av. Francisco Xavier Correa, 199 - Guarulhos - SP"
  },
  {
    name: "CAJAMAR (SORTATION DCC)",
    state: "SP",
    codes: ["BRXSP9", "BRXSP24"],
    address: "Cajamar DCC, SP, 07750-000",
    cnpj: "20.121.850/0117-85 / 03.007.331/0095-21"
  },
  {
    name: "SÃO PAULO (ZONA SUL - JURUBATUBA)",
    state: "SP",
    codes: ["SSP1", "SC_ZS"],
    address: "Av. das Nações Unidas, 21476 - Jurubatuba, São Paulo - SP, 04696-005",
    cnpj: "20.121.850/0012-08 / 03.007.331/0081-26"
  },
  {
    name: "CAMPINAS / SUMARÉ (TECHNO PARK)",
    state: "SP",
    codes: ["SSP3", "BRXSP2", "SSP37"],
    address: "Rod. Adauto Campo Dall'Orto, 1 - Nova Veneza, Sumaré - SP / Techno Park",
    cnpj: "20.121.850/0010-46 / 03.007.331/0111-86"
  },
  {
    name: "CRAVINHOS",
    state: "SP",
    codes: ["BRXSP5", "SSP4", "BRSP24"],
    address: "P724+CX, Cravinhos - SP, 14140-000",
    cnpj: "20.121.850/0011-27 / 03.007.331/0130-49"
  },
  {
    name: "BARUERI (ARENA COLETA / DESCARGA)",
    state: "SP",
    codes: ["BRXSP1", "SSP5"],
    address: "Rua Jussara, 1250, Tamboré - Barueri, SP - CEP: 06465-070",
    restrictions: "Restrição de VUC",
    cnpj: "20.121.850/0007-40 / 03.007.331/0087-11"
  },
  {
    name: "MAUÁ (ZONA LESTE)",
    state: "SP",
    codes: ["SSP6"],
    address: "Avenida Alberto Soares Sampaio, nº 1.764, Capuava, Mauá – SP. CEP: 09380-000",
    restrictions: "Restrição de Carretas com modificações / veículos com plataforma",
    cnpj: "20.121.850/0013-99 / 03.007.331/0022-76"
  },
  {
    name: "SÃO PAULO (ZONA OESTE - VILA ANASTÁCIO)",
    state: "SP",
    codes: ["SSP7", "BRSP35", "SSP59"],
    address: "R. Campos Vergueiro, 131 - Vila Anastácio, São Paulo - SP, 05095-020",
    restrictions: "Restrição de Carretas",
    cnpj: "20.121.850/0014-70 / 03.007.331/0025-19"
  },
  {
    name: "SÃO JOSÉ DOS CAMPOS (CAÇAPAVA)",
    state: "SP",
    codes: ["SSP8"],
    address: "Rodovia Presidente Dutra km 134 - Santa Luzia, Caçapava - SP, 12286-160",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0034-13 / 03.007.331/0088-00"
  },
  {
    name: "LIMEIRA",
    state: "SP",
    codes: ["SSP9"],
    address: "DVR Business Park Limeira, SP-330, km 146 - Jardim Nova Limeira, Limeira - SP, 13486-199",
    cnpj: "20.121.850/0022-80 / 03.007.331/0089-83"
  },
  {
    name: "ARAÇATUBA",
    state: "SP",
    codes: ["SSP10", "BRXSP12"],
    address: "R. Quatrocentos E Cinquenta e Dois, 436 - Centro, Araçatuba - SP, 16010-970",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0071-68 / 03.007.331/0023-57"
  },
  {
    name: "PRESIDENTE PRUDENTE",
    state: "SP",
    codes: ["SSP11", "BRXSP11"],
    address: "Rua Izabel Becegato Costa, 230 - Jardim Planalto - Presidente Prudente - SP",
    cnpj: "20.121.850/0062-77 / 03.007.331/0090-17"
  },
  {
    name: "SÃO JOSÉ DO RIO PRETO",
    state: "SP",
    codes: ["SSP12"],
    address: "Avenida Jornalista Roberto Marinho, 2997, Jardim Primavera / Villa Cassini - SJRP - SP, 15061-500",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0051-14 / 03.007.331/0050-20"
  },
  {
    name: "MARÍLIA",
    state: "SP",
    codes: ["SSP13", "BRXSP14"],
    address: "V22W+QR5 Marília, SP",
    cnpj: "20.121.850/0023-60 / 03.007.331/0082-07"
  },
  {
    name: "BAURU",
    state: "SP",
    codes: ["SSP14", "BRXSP7"],
    address: "Business Park - Rod. Mal. Rondon, km 348 - Jardim Jaragua, Bauru - SP",
    cnpj: "20.121.850/0025-22 / 03.007.331/0083-98"
  },
  {
    name: "SANTOS (SÃO VICENTE)",
    state: "SP",
    codes: ["SSP15"],
    address: "Av. Antônio Bernardo, 3.750 - Parque Continental, São Vicente - SP, 11349-380",
    restrictions: "Restrição de VUC",
    cnpj: "20.121.850/0105-41 / 03.007.331/0086-30"
  },
  {
    name: "CARAGUATATUBA",
    state: "SP",
    codes: ["SSP16"],
    address: "Av José Herculano, 8397 - Perequê Mirim - Caraguatatuba/SP - CEP: 11668-600",
    cnpj: "20.121.850/0075-91 / 03.007.331/0091-06"
  },
  {
    name: "SÃO BERNARDO DO CAMPO",
    state: "SP",
    codes: ["SSP17", "BRXSP4", "BRSP31", "BRSP33", "SSP52"],
    address: "Estrada Particular Sadae Takagi, 2235 - Cooperativa / R. Capivari, 200 - Batistini / Rua Max Mangels Senior, 823 - Planalto, SBC - SP",
    cnpj: "20.121.850/0031-70 / 03.007.331/0049-96 / 03.007.331/0265-31"
  },
  {
    name: "SANTO ANDRÉ",
    state: "SP",
    codes: ["BRSP34", "BRXSP18"],
    address: "Avenida Antônio Cardoso 319, Bangú, Santo André - SP, CEP: 09280-570"
  },
  {
    name: "JUNDIAÍ",
    state: "SP",
    codes: ["SSP18"],
    address: "Av. Antônio Frederico Ozanan, 11100 - Distrito Industrial (Bandeirantes Business Park), Jundiaí - SP, 13213-030",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0039-28 / 03.007.331/0084-79"
  },
  {
    name: "GUARULHOS (GLP GAIOLI)",
    state: "SP",
    codes: ["SSP19", "BRXSP6"],
    address: "Av Julia Gaiolli, 740, Água Chata, Guarulhos - SP, CEP: 07251-500",
    restrictions: "Restrição de VUC",
    cnpj: "20.121.850/0088-06 / 03.007.331/0119-33"
  },
  {
    name: "SÃO PAULO (PARQUE NOVO MUNDO)",
    state: "SP",
    codes: ["SSP40", "SSP49", "BRXSP16"],
    address: "Rua Cabo Norberto Enrique Weber, 222 - Parque Novo Mundo, São Paulo - SP, 02147-040",
    cnpj: "03.007.331/0172-06"
  },
  {
    name: "SÃO PAULO (ITAQUERA)",
    state: "SP",
    codes: ["SSP45"],
    address: "Av. Jean Khoury Farah, 400 - Artur Alvim, São Paulo - SP, 08295-015"
  },
  {
    name: "SÃO PAULO (JAGUARÉ)",
    state: "SP",
    codes: ["SSP48"],
    address: "Avenida Engenheiro Billings, 2227, Jaguaré, São Paulo - SP, 05321-010",
    restrictions: "Sem restrição",
    cnpj: "03.007.331/0244-07"
  },
  {
    name: "SOROCABA",
    state: "SP",
    codes: ["SSP20"],
    address: "R. Moacyr Ozeas Guitti - Jardim Ibiti do Paco, Sorocaba - SP, 18086-020",
    cnpj: "20.121.850/0041-42 / 03.007.331/0052-91"
  },
  {
    name: "SÃO PAULO (MOOCA)",
    state: "SP",
    codes: ["SSP21"],
    address: "Av Henry Ford, 654 - Mooca, São Paulo - SP",
    restrictions: "Restrição de Carretas / Truck com altura máxima de 4,10m",
    cnpj: "20.121.850/0042-23 / 03.007.331/0012-02"
  },
  {
    name: "SÃO CARLOS",
    state: "SP",
    codes: ["SSP22"],
    address: "São Carlos - Bela Vista São-Carlense, São Paulo - SP",
    cnpj: "20.121.850/0074-00 / 03.007.331/0118-52"
  },
  {
    name: "MOGI DAS CRUZES (SUZANO)",
    state: "SP",
    codes: ["SSP23"],
    address: "Rua Baruel, 2000 - Vila Costa - Suzano - SP",
    cnpj: "20.121.850/0084-82 / 03.007.331/0104-57"
  },
  {
    name: "AVARÉ",
    state: "SP",
    codes: ["SSP24"],
    address: "Rua Luis Scarceli, 254, Avaré - SP",
    cnpj: "20.121.850/0112-70 / 03.007.331/0085-50"
  },
  {
    name: "ATIBAIA",
    state: "SP",
    codes: ["SSP25"],
    address: "Rod. Dom Pedro I, Km 87,5 - Pte. Alta, Atibaia - SP, CEP: 12940-303",
    cnpj: "20.121.850/0103-80 / 03.007.331/0093-60"
  },
  {
    name: "FRANCA",
    state: "SP",
    codes: ["SSP26", "BRXSP8"],
    address: "Rua Joaquim Corrêa Junior, 3230 - Distrito Industrial - Franca - SP",
    cnpj: "20.121.850/0101-18 / 03.007.331/0094-40"
  },
  {
    name: "ITAPETININGA",
    state: "SP",
    codes: ["SSP27"],
    address: "Av. João Olímpio de Oliveira, 1570 - Vila Asem, Itapetininga - SP, 18202-000",
    cnpj: "20.121.850/0098-88 / 03.007.331/0051-00"
  },
  {
    name: "JALES",
    state: "SP",
    codes: ["SSP28"],
    address: "R. Ipiranga, 709 - Jardim Ipiranga - Jales - SP - CEP: 15707-032",
    cnpj: "20.121.850/0089-97 / 03.007.331/0105-38"
  },
  {
    name: "MOGI MIRIM",
    state: "SP",
    codes: ["SSP29"],
    address: "Rod. Gov. Dr. Adhemar Pereira de Barros, 30590 - Jardim Maria Bonati Bordignon - Mogi Mirim - SP",
    cnpj: "20.121.850/0092-92 / 03.007.331/0106-19"
  },
  {
    name: "GUARULHOS (GALPÃO C - CUMBICA)",
    state: "SP",
    codes: ["SSP30", "BRXSP10", "BRSP27"],
    address: "R. Concretex, 800 / R. Maria García Utrila, 200 - Cumbica, Guarulhos - SP, 07232-050",
    cnpj: "20.121.850/0118-66 / 03.007.331/0080-45"
  },
  {
    name: "GUARULHOS (FULFILLMENT - GALPÃO H)",
    state: "SP",
    codes: ["BRSP11"],
    address: "GGJR+PXX Guarulhos, SP (Galpão H)"
  },
  {
    name: "BARRETOS",
    state: "SP",
    codes: ["SSP31"],
    address: "R. Di- Doze, 300 - Pedro Pinto Paixao, Barretos - SP, 14781-167",
    cnpj: "20.121.850/0102-07 / 03.007.331/0110-03"
  },
  {
    name: "COTIA",
    state: "SP",
    codes: ["SSP34", "BRSP25"],
    address: "Rua Philip Leiner, 100 - Parque Alexandre / R. dos Carvalho, Cotia - SP, 06714-285",
    cnpj: "03.007.331/0142-82"
  },
  {
    name: "GUARULHOS (KSM LOG)",
    state: "SP",
    codes: ["BRSP21", "BRXSP22"],
    address: "Avenida Paschoal Thomeu, 2585 – Guarulhos - SP – Condomínio KSM Log Guarulhos"
  },
  {
    name: "PIRACICABA",
    state: "SP",
    codes: ["SSP36"],
    address: "R. Frei Honório Franco, 220 - Abaeté, Piracicaba - SP, 13420-256",
    cnpj: "03.007.331/0166-50"
  },
  {
    name: "ITUPEVA",
    state: "SP",
    codes: ["SSP38"],
    address: "Estrada Municipal Benedito de Souza s/n - Aglomeração Urbana de Jundiaí, Itupeva - SP, 13295-000",
    cnpj: "03.007.331/0138-04"
  },
  {
    name: "LORENA",
    state: "SP",
    codes: ["SSP39"],
    address: "Rod. Pres. Dutra, 318 - Parque das Rodovias, Lorena - SP, 12605-530"
  },
  {
    name: "SÃO PAULO (VILA LEOPOLDINA)",
    state: "SP",
    codes: ["SSP44"],
    address: "Rua Mergenthaler, 900, Vila Leopoldina, São Paulo - SP"
  },
  {
    name: "PORTO FELIZ",
    state: "SP",
    codes: ["SSP51"],
    address: "Rua Eduardo Lucchese, 15, Bairro Indaiatuba – Porto Feliz - SP"
  },
  {
    name: "CUBATÃO",
    state: "SP",
    codes: ["SSP35"],
    address: "Av. Nossa Sra. de Fátima, 1322 - Casqueiro, Cubatão - SP, 11530-030"
  },
  {
    name: "EMBU DAS ARTES",
    state: "SP",
    codes: ["BRRC03"],
    address: "Avenida Isaltino Victor de Moraes 437, Vila Bonfim, Embu das Artes - SP, CEP: 06806-400"
  },
  {
    name: "BARUERI (SANTA CECILIA)",
    state: "SP",
    codes: ["BRXSP27"],
    address: "Av. Pirambóia, 3254 - Jardim Santa Cecilia, Barueri - SP, 06465-060"
  },
  {
    name: "FRANCO DA ROCHA (JORDANÉSIA)",
    state: "SP",
    codes: ["BRXSP17"],
    address: "Estrada dos Cristais, Jordanésia - Franco da Rocha - SP"
  },

  // Paraná
  {
    name: "CURITIBA",
    state: "PR",
    codes: ["SPR1"],
    address: "R. São Bento, 2143 - Hauer, Curitiba - PR, 81630-230",
    cnpj: "20.121.850/0064-39 / 03.007.331/0016-28"
  },
  {
    name: "LONDRINA",
    state: "PR",
    codes: ["SPR2", "BRXPR2"],
    address: "Log Londrina, Av. Tiradentes, 7100 - Jardim Rosicler, Londrina - PR, 86072-000",
    restrictions: "Não descarrega final de semana, só segunda",
    cnpj: "03.007.331/0165-79"
  },
  {
    name: "CASCAVEL",
    state: "PR",
    codes: ["SPR3", "BRXPR3"],
    address: "Rua 02, nº 100, Núcleo de Produção Industrial II Cataratas - CEP 85820-899 - Cascavel - PR",
    restrictions: "Restrição de VUC",
    cnpj: "20.121.850/0040-61 / 03.007.331/0132-00"
  },
  {
    name: "PATO BRANCO",
    state: "PR",
    codes: ["SPR4"],
    address: "Vila Esperança - São Braz, Pato Branco - PR, 85503-301",
    restrictions: "Operação não funciona no domingo, somente na segunda à partir da 01:00h",
    cnpj: "20.121.850/0078-34 / 03.007.331/0020-04"
  },
  {
    name: "GUARAPUAVA",
    state: "PR",
    codes: ["SPR5"],
    address: "R. Tucuruí, 3927 - Jardim das Americas, Guarapuava - PR",
    cnpj: "20.121.850/0082-10 / 03.007.331/0019-70"
  },
  {
    name: "MARINGÁ",
    state: "PR",
    codes: ["SPR6", "BRXPR4"],
    address: "Chácara TransPanorama, BR 376 - Nº 13461 Rod. do Café Gov. Ney Braga- Maringá - PR, 87070-610",
    cnpj: "20.121.850/0083-00 / 03.007.331/0017-09"
  },
  {
    name: "PONTA GROSSA",
    state: "PR",
    codes: ["SPR7"],
    address: "BR-376, 36000 - Colonia Dona Luiza, Ponta Grossa - PR, 84043-450 - Condomínio Interalli Realty",
    cnpj: "20.121.850/0094-54 / 03.007.331/0018-90"
  },
  {
    name: "CAMPINA GRANDE DO SUL",
    state: "PR",
    codes: ["SPR8", "XPR1"],
    address: "Mega Centro Logístico Nº 1500 - Curitiba - PR",
    cnpj: "03.007.331/0160-64"
  },
  {
    name: "ARAUCÁRIA",
    state: "PR",
    codes: ["BRPR01"],
    address: "R. Ubirajara Sávio Torres - Boqueirão, Araucária - PR"
  },

  // Santa Catarina
  {
    name: "JOINVILLE",
    state: "SC",
    codes: ["SSC1"],
    address: "BR-101, 46659 - KM 46 - Santa Catarina, Joinville - SC, 89233-190",
    restrictions: "Restrição de VUC",
    cnpj: "20.121.850/0063-58 / 03.007.331/0071-54"
  },
  {
    name: "FLORIANÓPOLIS (BIGUAÇU)",
    state: "SC",
    codes: ["SSC2"],
    address: "R. Edgard Hoffmann, 496 - Biguaçu, SC, 88160-000",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0030-90 / 03.007.331/0053-72"
  },
  {
    name: "BLUMENAU (GASPAR)",
    state: "SC",
    codes: ["SSC3"],
    address: "R. Me. Paulina, 560 - Sete de Setembro, Gaspar - SC, 89115-065",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0047-38 / 03.007.331/0125-81"
  },
  {
    name: "CHAPECÓ",
    state: "SC",
    codes: ["SSC4"],
    address: "SC 283, S/N - LINHA SÃO ROQUE - CHAPECÓ - SC (ref: fabrica de ração belas aves)",
    cnpj: "20.121.850/0049-08 / 03.007.331/0200-96"
  },
  {
    name: "CRICIÚMA (MORRO DA FUMAÇA)",
    state: "SC",
    codes: ["SSC5"],
    address: "Rod. Genésio Mazon, 4 - Palladini, Morro da Fumaça - SC, 88830-000",
    cnpj: "20.121.850/0109-75 / 03.007.331/0070-73"
  },
  {
    name: "LAGES",
    state: "SC",
    codes: ["SSC7"],
    address: "R. Heliodoro Muniz - 1590 ÁREA INDUSTRIAL - LAGES - SC",
    restrictions: "Operação no domingo funciona à partir das 22h",
    cnpj: "20.121.850/0111-90 / 03.007.331/0069-30"
  },
  {
    name: "ITAJAÍ",
    state: "SC",
    codes: ["SSC8"],
    address: "Rod. Jorge Lacerda, 1084 - Espinheiros, Itajaí - SC, 88317-100"
  },

  // Rio Grande do Sul
  {
    name: "SAPUCAIA DO SUL / CAPÃO DA CANOA",
    state: "RS",
    codes: ["SRS8", "BRRS01"],
    address: "Av. Borges de Medeiros, 1771 - Colonial, Sapucaia do Sul - RS, 93212-110",
    cnpj: "20.121.850/0026-03 / 03.007.331/0043-09 / 20.121.850/0113-51"
  },
  {
    name: "GUAÍBA (FULL RIO GRANDE DO SUL)",
    state: "RS",
    codes: ["BRRS03"],
    address: "BR-116, KM 297 - Chaves Barcellos, Guaíba - RS, 92710-000"
  },
  {
    name: "GRAVATAÍ",
    state: "RS",
    codes: ["BRRS04"],
    address: "ROD. MÁRIO QUINTANA (ERS 118), Nº 10250, BAIRRO MONTE CLARO - GRAVATAÍ - RS - CEP: 94.100-420"
  },
  {
    name: "PORTO ALEGRE / NOVA SANTA RITA",
    state: "RS",
    codes: ["BRXRS1", "SRS9"],
    address: "Rua Amilton da Silva Amorim, Floresta, 86 ,Cond Logístico Acorianos, Nova Santa Rita - RS - 92480-000"
  },
  {
    name: "PORTO ALEGRE (JARDIM SÃO PEDRO)",
    state: "RS",
    codes: ["SRS1"],
    address: "Rua da Várzea, 481, Jardim São Pedro, Porto Alegre - RS, 91040-600"
  },
  {
    name: "PELOTAS",
    state: "RS",
    codes: ["SRS2"],
    address: "BR-392, 0 - Fragata, Pelotas - RS, 96050-500",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0052-03 / 03.007.331/0042-10"
  },
  {
    name: "SANTA MARIA",
    state: "RS",
    codes: ["SRS3"],
    address: "Rod. RST-287, 3250 - São José, Santa Maria - RS, 97105-030"
  },
  {
    name: "CAXIAS DO SUL (FLORES DA CUNHA)",
    state: "RS",
    codes: ["SRS4"],
    address: "Estrada das Indústrias, 2030 - Lagoa Bella, Flores da Cunha - RS, 95270-000",
    restrictions: "Restrição de VUC",
    cnpj: "20.121.850/0065-10 / 03.007.331/0037-52"
  },
  {
    name: "PASSO FUNDO",
    state: "RS",
    codes: ["SRS5"],
    address: "Rua Alonso de Camargo, 560 - Prof. Schisler, Passo Fundo - RS, 99032-040"
  },
  {
    name: "ALEGRETE",
    state: "RS",
    codes: ["SRS6"],
    address: "CD Mercado Livre - Alegrete/RS, BR-290 - Alegrete, RS",
    cnpj: "20.121.850/0080-59 / 03.007.331/0035-90"
  },
  {
    name: "IJUÍ",
    state: "RS",
    codes: ["SRS7"],
    address: "RS-522, 280 - Distrito Industrial, Ijuí - RS, 98700-000",
    cnpj: "20.121.850/0081-30 / 03.007.331/0044-81"
  },
  {
    name: "LAJEADO (ESTRELA)",
    state: "RS",
    codes: ["SRS10"],
    address: "F38M+VW - Glória, Estrela - RS, 95880-000",
    cnpj: "20.121.850/0119-47 / 03.007.331/0041-39"
  },

  // Rio de Janeiro
  {
    name: "RIO DE JANEIRO (CORDOVIL)",
    state: "RJ",
    codes: ["SRJ1", "BRRJ01", "XRJ1"],
    address: "R. Francisco de Souza e Melo, 1590 - Cordovil (Cargo Park), Rio de Janeiro - RJ, 21012-350",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0021-07 / 03.007.331/0102-95"
  },
  {
    name: "QUEIMADOS (NOVA IGUAÇU)",
    state: "RJ",
    codes: ["SRJ2"],
    address: "Rod. Presidente Dutra 25551, Nova Iguaçu - RJ / Cargo Dutra V, 27175-000, Piraí",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0024-41 / 03.007.331/0134-72"
  },
  {
    name: "SÃO JOÃO DE MERITI",
    state: "RJ",
    codes: ["BRRJ02", "SRJ13"],
    address: "Rodovia Presidente Dutra, nº 4.674, Centro, São João do Meriti - RJ - Condomínio Prologis Dutra RJ II"
  },
  {
    name: "VOLTA REDONDA (BARRA MANSA)",
    state: "RJ",
    codes: ["SRJ3"],
    address: "Rod. Pres. Dutra, 200 - Km 268,5 - Boa Sorte, Barra Mansa - RJ, 27355-640",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0046-57 / 03.007.331/0067-78"
  },
  {
    name: "CAMPOS DOS GOYTACAZES",
    state: "RJ",
    codes: ["SRJ4"],
    address: "AVENIDA NILO PECANHA, 1516 - PQ DOS RODOVIÁRIOS (Unilogistica), Campos dos Goytacazes - RJ",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0050-33 / 03.007.331/0056-15"
  },
  {
    name: "PETRÓPOLIS",
    state: "RJ",
    codes: ["SRJ5"],
    address: "BR-040, 1250 - Pedro do Rio, Petrópolis - RJ, 25755-415",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0048-19 / 03.007.331/0103-76"
  },
  {
    name: "RIO DE JANEIRO (MENDANHA / CAMPO GRANDE)",
    state: "RJ",
    codes: ["SRJ6"],
    address: "Av. Brasil, 41432 - Campo Grande, Rio de Janeiro - RJ, 23078-001",
    restrictions: "Restrição de VUC e Médio, e Dificuldade de Manobra com Carretas",
    cnpj: "20.121.850/0085-63 / 03.007.331/0128-24"
  },
  {
    name: "MACAÉ",
    state: "RJ",
    codes: ["SRJ7"],
    address: "R. Mário Figueiredo Proença, 151 - Imboassica, Macaé - RJ, 27932-305",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0059-71 / 03.007.331/0055-34"
  },
  {
    name: "NITERÓI (MANILHA)",
    state: "RJ",
    codes: ["SRJ8"],
    address: "Rodovia Manilha, Av. Magé, s/n - Km 1 - Manilha - RJ, 24857-500",
    restrictions: "Restrição de VUC, Médio e Restrição de Carretas",
    cnpj: "20.121.850/0066-09 / 03.007.331/0116-90"
  },
  {
    name: "CABO FRIO (SÃO PEDRO DA ALDEIA)",
    state: "RJ",
    codes: ["SRJ9"],
    address: "Rodovia Amaral Peixoto, Estr. São Mateus, s/n - KM 114, São Pedro da Aldeia - RJ, 28940-000",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0070-87 / 03.007.331/0066-97"
  },
  {
    name: "RIO DE JANEIRO (BARRA / JACAREPAGUÁ)",
    state: "RJ",
    codes: ["SRJ10"],
    address: "Estr. dos Bandeirantes, 3091 - Jacarepaguá, Rio de Janeiro - RJ, 22775-111",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0073-20 / 03.007.331/0109-61"
  },
  {
    name: "ITAPERUNA",
    state: "RJ",
    codes: ["SRJ12"],
    address: "Av. Pres. Dutra, 1230 - Cidade Nova, Itaperuna - RJ, CEP: 28300-000",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0097-05 / 03.007.331/0057-04"
  },

  // Espírito Santo
  {
    name: "VITÓRIA (SERRA)",
    state: "ES",
    codes: ["SES1", "BRXES1", "BRES01"],
    address: "Av. Principal 1, 852 - Campo Log II, Serra - ES, 29168-100"
  },
  {
    name: "CACHOEIRO DE ITAPEMIRIM",
    state: "ES",
    codes: ["SES2"],
    address: "6R2V+9V Cachoeiro de Itapemirim, Espírito Santo",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0104-60 / 03.007.331/0123-10"
  },
  {
    name: "LINHARES",
    state: "ES",
    codes: ["SES3"],
    address: "Rod. Gov. Mário Covas, 232 - Farias, Linhares - ES"
  },

  // Minas Gerais
  {
    name: "CONTAGEM (CIDADE INDUSTRIAL)",
    state: "MG",
    codes: ["SMG1"],
    address: "Av. General David Sarnoff, 4500 - Cidade Industrial, Contagem - MG, 32260-272",
    cnpj: "20.121.850/0019-84 / 03.007.331/0061-82"
  },
  {
    name: "JUIZ DE FORA",
    state: "MG",
    codes: ["SMG2"],
    address: "BR-040, KM 786 - Santa Cruz, Juiz de Fora - MG, 36088-410",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0090-20 / 03.007.331/0029-42"
  },
  {
    name: "POUSO ALEGRE",
    state: "MG",
    codes: ["SMG3", "BRXMG3"],
    address: "Rod. Fernão Dias, Km 864 - Algodão, Pouso Alegre - MG, 37550-000",
    restrictions: "Restrição de Carretas",
    cnpj: "20.121.850/0120-80 / 03.007.331/0031-67"
  },
  {
    name: "IPATINGA",
    state: "MG",
    codes: ["SMG4"],
    address: "Rua Ricardo Caram Guimarães, 73 - Veneza, Ipatinga - MG",
    cnpj: "20.121.850/0038-47 / 03.007.331/0032-48"
  },
  {
    name: "POÇOS DE CALDAS",
    state: "MG",
    codes: ["SMG5"],
    address: "Av. Pres. Wenceslau Braz, 4630 - Parque Pinheiros - Poços de Caldas - MG, CEP: 37706-055",
    restrictions: "Restrição de Carretas",
    cnpj: "20.121.850/0043-04 / 03.007.331/0127-43"
  },
  {
    name: "UBERLÂNDIA",
    state: "MG",
    codes: ["SMG6", "BRXMG2"],
    address: "Rua César Mugnato, 151 - Distrito Industrial, Uberlândia - MG, 38402-810",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0061-96 / 03.007.331/0034-00"
  },
  {
    name: "MONTES CLAROS",
    state: "MG",
    codes: ["SMG7"],
    address: "R. 34, 1720 - Jardim Olímpico, Montes Claros - MG, 39406-503",
    restrictions: "Restrição de Carretas",
    cnpj: "11.028.793/0005-05 / 03.007.331/0147-97"
  },
  {
    name: "BELO HORIZONTE (VESPASIANO / GLP CONFINS)",
    state: "MG",
    codes: ["SMG8"],
    address: "Rodovia MG 010 - Km 22, R. Angicos, Vespasiano - MG, 33200-000",
    cnpj: "20.121.850/0072-49 / 03.007.331/0030-86"
  },
  {
    name: "DIVINÓPOLIS",
    state: "MG",
    codes: ["SMG10"],
    address: "Rod. Pres. Tancredo Neves Anel, 6050 - Bom Pastor, Divinópolis - MG, 35501-523",
    restrictions: "Restrição de Carreta"
  },
  {
    name: "VARGINHA",
    state: "MG",
    codes: ["SMG9"],
    address: "Rua Projetada PS, 333 - Aeroporto, Varginha - MG, CEP: 37031-090",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0099-69 / 03.007.331/0033-29"
  },
  {
    name: "PATOS DE MINAS",
    state: "MG",
    codes: ["SMG11"],
    address: "Av. das Quaresmeiras, 287 - Morada do Sol, Patos de Minas - MG",
    cnpj: "03.007.331/0062-63"
  },
  {
    name: "UBERABA",
    state: "MG",
    codes: ["SMG12"],
    address: "Av. João XXIII, 2740 - Parque das Americas, Uberaba - MG, 38045-100",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0106-22 / 03.007.331/0124-09"
  },
  {
    name: "TEÓFILO OTONI",
    state: "MG",
    codes: ["SMG13"],
    address: "4F2G+WJX Teófilo Otoni - MG",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0121-61 / 03.007.331/0101-04"
  },
  {
    name: "NOVA LIMA",
    state: "MG",
    codes: ["SMG14"],
    address: "Rua Star, 319 - Jardim Canadá, Nova Lima - MG, CEP: 34000-000"
  },
  {
    name: "CONTAGEM (GOLIVE / XPEX)",
    state: "MG",
    codes: ["SMG15", "XMG1", "SMG18"],
    address: "R. das Contendas - Chácara Campestre, 1.807 / nº 1000, Contagem - MG, 32184-010"
  },
  {
    name: "BETIM",
    state: "MG",
    codes: ["BRMG02"],
    address: "2P3Q+W4 - Pedreira, Betim - MG"
  },
  {
    name: "EXTREMA (FULL III & IV)",
    state: "MG",
    codes: ["BRMG03", "BRMG04"],
    address: "Juncal, Extrema - MG, 37640-000"
  },

  // Distrito Federal & Centro-Oeste
  {
    name: "BRASÍLIA (LAGO SUL)",
    state: "DF",
    codes: ["SDF1", "BRDF01"],
    address: "Presidente Juscelino Kubitschek, 1400 - Lago Sul, Brasília - DF, 71608-900",
    cnpj: "20.121.850/0018-01 / 03.007.331/0046-43"
  },
  {
    name: "BRASÍLIA (SANTA MARIA)",
    state: "DF",
    codes: ["SDF2"],
    address: "Trecho 1 Polo de desenvolvimento Conjunto 8 Lote 17 - Santa Maria, Brasília - DF",
    cnpj: "20.121.850/0137-29 / 03.007.331/0143-63"
  },
  {
    name: "GOIÂNIA",
    state: "GO",
    codes: ["SGO1"],
    address: "R. Doná Todica, 176 - Sítio de Recreio Ipê, Goiânia - GO, Galpão Fazenda Retiro",
    cnpj: "20.121.850/0015-50 / 03.007.331/0108-80"
  },
  {
    name: "HIDROLÂNDIA",
    state: "GO",
    codes: ["BRXGO1", "SGO3"],
    address: "BR-153, KM 518 - Fazenda Santo Antônio, Hidrolândia - GO, 75340-000"
  },
  {
    name: "RIO VERDE",
    state: "GO",
    codes: ["SGO2"],
    address: "64F5+2X - Rio Verde - GO",
    cnpj: "20.121.850/0096-16 / 03.007.331/0038-33"
  },
  {
    name: "CUIABÁ",
    state: "MT",
    codes: ["SMR1"],
    address: "Rua I - Distrito Industrial, Cuiabá - MT, CEP: 78098-350",
    cnpj: "20.121.850/0069-43 / 03.007.331/0054-53"
  },
  {
    name: "SINOP",
    state: "MT",
    codes: ["SMR2"],
    address: "Colonizador Enio Pipino, s/n - Jardim Umuarama, Sinop - MT, 78558-260"
  },
  {
    name: "CAMPO GRANDE",
    state: "MS",
    codes: ["SMS1"],
    address: "Avenida Ministro João Arinos, 5.750 - Bairro Tiradentes - Campo Grande - MS",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "04.796.094/0001-08 / 03.007.331/0149-59"
  },
  {
    name: "DOURADOS",
    state: "MS",
    codes: ["SMS2"],
    address: "Av. Marcelino Píres, 10155, Dourados - MS, CEP: 79841-000",
    restrictions: "Restrição de VUC e Médio",
    cnpj: "20.121.850/0107-03 / 03.007.331/0027-80"
  },

  // Nordeste & Norte
  {
    name: "MACEIÓ",
    state: "AL",
    codes: ["SAL1"],
    address: "R. Telma Leão, 2726-2350 - Tabuleiro do Martins, Maceió - AL",
    cnpj: "20.121.850/0060-05 / 03.007.331/0045-62"
  },
  {
    name: "MANAUS",
    state: "AM",
    codes: ["SAM1", "BRXAM1"],
    address: "Avenida Torquato Tapajós, 7503, Bairro Tarumã, Manaus - AM",
    cnpj: "20.121.850/0116-02 / 03.007.331/0047-24"
  },
  {
    name: "MACAPÁ",
    state: "AP",
    codes: ["SAP1"],
    address: "Rod. Juscelino Kubitschek, 2731 - Universidade, Macapá - AP, CEP: 68903-419",
    cnpj: "20.121.850/0114-32 / 03.007.331/0126-62"
  },
  {
    name: "SALVADOR (SIMÕES FILHO)",
    state: "BA",
    codes: ["SBA1", "BRXBA1"],
    address: "LOG Salvador - Av. Elmo Serejo de Farias, n° 3333 - Nucleo Hab. Rubens Costa Cia I, Simões Filho - BA, 43700-000",
    cnpj: "20.121.850/0057-00 / 03.007.331/0099-55"
  },
  {
    name: "FEIRA DE SANTANA",
    state: "BA",
    codes: ["SBA2", "SBA4"],
    address: "GRID FSA, BR 324 KM 525 SN - Cis, Feira de Santana - BA, 44097-324 (Galpão 26B)",
    cnpj: "20.121.850/0077-53 / 03.007.331/0107-08"
  },
  {
    name: "VITÓRIA DA CONQUISTA",
    state: "BA",
    codes: ["SBA3"],
    address: "Rodovia BR-116, Lote Especial Fundo, S/N, Distrito Industrial dos Imborés - Lagoa das Flores, Vitória da Conquista - BA",
    cnpj: "20.121.850/0076-72 / 03.007.331/0098-74"
  },
  {
    name: "FORTALEZA",
    state: "CE",
    codes: ["SCE1", "BRXCE1"],
    address: "BR-116, nº 2186, Cajazeiras - Fortaleza - Ceará",
    cnpj: "20.121.850/0016-31 / 03.007.331/0100-23"
  },
  {
    name: "JOÃO PESSOA",
    state: "PB",
    codes: ["SJP1"],
    address: "Rodovia BR 101 km 101 Centro - PB, 58322-900",
    cnpj: "20.121.850/0058-90 / 03.007.331/0026-08"
  },
  {
    name: "SÃO LUÍS",
    state: "MA",
    codes: ["SMN1"],
    address: "R. Sen. João Pedro, 125 - Fabril, São Luís - MA, CEP: 65025-790",
    cnpj: "20.121.850/0067-81 / 03.007.331/0039-14"
  },
  {
    name: "BELÉM (ANANINDEUA)",
    state: "PA",
    codes: ["SPA1"],
    address: "Rodovia BR-316, Centro, Ananindeua - PA, 67030-007 (Km 08 Galpão 07)",
    cnpj: "20.121.850/0086-44 / 03.007.331/0068-59"
  },
  {
    name: "RECIFE (JABOATÃO DOS GUARARAPES)",
    state: "PE",
    codes: ["SPE1", "BRXPE1"],
    address: "Rua Riachão, 807 - Muribeca, Jaboatão dos Guararapes - PE, 54355-057",
    cnpj: "20.121.850/0045-76 / 03.007.331/0021-95"
  },
  {
    name: "CABO DE SANTO AGOSTINHO",
    state: "PE",
    codes: ["SPE2", "SPE3", "BRPE01"],
    address: "BR-101 Sul, 9415 – Distrito Industrial Santo Estevão, Cabo de Santo Agostinho – PE / Res. Morada Verde",
    cnpj: "03.007.331/0183-50"
  },
  {
    name: "TERESINA",
    state: "PI",
    codes: ["SPI1"],
    address: "Rua B, Lote 725, Distrito Industrial, Teresina - PI, 64027-462",
    cnpj: "20.121.850/0068-62 / 03.007.331/0140-10"
  },
  {
    name: "PORTO VELHO",
    state: "RO",
    codes: ["SRD1"],
    address: "Av. Jatuarana, 356, Floresta - Porto Velho - RO, CEP: 76808-426",
    cnpj: "20.121.850/0115-13 / 03.007.331/0096-02"
  },
  {
    name: "NATAL (MACAÍBA)",
    state: "RN",
    codes: ["SRN1"],
    address: "Rua Projetada, 5 - Macaíba - RN - Rod. BR 304, km 301",
    cnpj: "20.121.850/0056-29 / 03.007.331/0136-34"
  },
  {
    name: "ARACAJU (NOSSA SRA. DO SOCORRO)",
    state: "SE",
    codes: ["SSE1"],
    address: "Av. Chesf, 300 - Lot, R. Itacanema II, Nossa Sra. do Socorro - SE, 49160-000",
    cnpj: "20.121.850/0037-66 / 03.007.331/0058-87"
  },
  {
    name: "PALMAS",
    state: "TO",
    codes: ["STO1"],
    address: "Q. 212 Sul Rua SR 11, 145 - Arse, Palmas - TO, 77020-616",
    cnpj: "20.121.850/0130-52 / 03.007.331/0141-00"
  },

  // Aeroportos / Hubs Aéreos
  {
    name: "BRASÍLIA AIR",
    state: "DF",
    codes: ["BRADF1"],
    address: "Área especial, Lago Sul, S/N - Brasília - DF, 71608-900"
  },
  {
    name: "GOIÂNIA AIR",
    state: "GO",
    codes: ["BRAGO1"],
    address: "Santa Genoveva, Goiânia - GO, 74672-420"
  },
  {
    name: "BELÉM AIR",
    state: "PA",
    codes: ["BRAPA1"],
    address: "Aeroporto Internacional de Belém - PA"
  },
  {
    name: "PORTO ALEGRE AIR",
    state: "RS",
    codes: ["BRARS1"],
    address: "Av. Severo Dullius, 90.010 - Anchieta, Porto Alegre - RS, 90200-310"
  },
  {
    name: "VITÓRIA AIR",
    state: "ES",
    codes: ["BRASE1"],
    address: "Aeroporto de Vitória - ES"
  },
  {
    name: "RECIFE AIR",
    state: "PE",
    codes: ["BRAPE1"],
    address: "Aeroporto Internacional do Recife - PE"
  },
  {
    name: "MANAUS AIR",
    state: "AM",
    codes: ["BRAAM1"],
    address: "Aeroporto Internacional de Manaus - AM"
  },
  {
    name: "GUARULHOS AIR (MELI / GOLLOG / AZUL / LATAM)",
    state: "SP",
    codes: ["BRASP1", "BRASP1_T", "BRASP1_G", "BRASP1_A", "BRASP1_L"],
    address: "R. Interna do Aeroporto Internacional de Guarulhos, 2 - Terminal 2 / Galpão G200 / Galpão G300, Guarulhos - SP",
    cnpj: "20.121.850/0095-35 / 03.007.331/0092-89"
  },
  {
    name: "CAMPINAS AIR (VIRACOPOS)",
    state: "SP",
    codes: ["BRASP2"],
    address: "Azul Cargo Aeroporto de Viracopos, Campinas - SP"
  },
  {
    name: "SÃO PAULO AIR (CONGONHAS)",
    state: "SP",
    codes: ["BRASP3"],
    address: "Gol Log Congonhas, São Paulo - SP"
  }
];

// Helper to convert to City objects with IDs
export function getInitialDefaultCities() {
  return MELI_HUBS.map((hub, idx) => ({
    id: `meli-city-${idx + 1}`,
    name: hub.name,
    state: hub.state,
    codes: hub.codes.map((c, cIdx) => ({
      id: `code-${idx + 1}-${cIdx + 1}`,
      code: c.toUpperCase().trim(),
      active: true
    })),
    active: true,
    createdAt: new Date().toISOString(),
    address: hub.address,
    restrictions: hub.restrictions,
    cnpj: hub.cnpj
  }));
}

// Build known city codes dictionary for OCR
export function getKnownCityCodesMap(): Record<string, { city: string; state: string }> {
  const map: Record<string, { city: string; state: string }> = {};
  for (const hub of MELI_HUBS) {
    for (const code of hub.codes) {
      const clean = code.toUpperCase().trim();
      map[clean] = {
        city: hub.name,
        state: hub.state
      };
    }
  }
  return map;
}
