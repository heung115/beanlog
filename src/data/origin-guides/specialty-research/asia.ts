import type { OriginGuideSource, OriginSpecialtyLot, OriginSpecialtyProfile } from '../types.ts';

const source = (title: string, url: string, publisher: string, accessedAt = '2026-09-08'): OriginGuideSource => ({
  title, url, publisher, accessedAt,
});

const ratu: OriginSpecialtyLot = {
  name: 'Ratu Ketiara Gayo — CJO1518',
  producer: 'Ratu Ketiara Gayo women’s cooperative',
  location: 'Takengon / Lake Laut Tawar, Aceh, Sumatra',
  varieties: [],
  process: { ko: '웻헐드', en: 'Wet hulled' },
  flavorNotes: { ko: ['세이지', '레몬그라스', '카카오', '솔티드 캐러멜'], en: ['Sage', 'Lemongrass', 'Cacao', 'Salted caramel'] },
  sources: [source('Crown Jewel Sumatra FT Organic Aceh Ratu Ketiara Gayo Wet Hulled CJO1518', 'https://royalcoffee.com/product/3427097000019024025/', 'Royal Coffee')],
};

const ribang: OriginSpecialtyLot = {
  name: 'Ribang Gayo — Dry Process 8331',
  producer: 'Ribang Gayo Musara Cooperative',
  location: 'Pantan Musara, Takengon, Aceh, Sumatra',
  varieties: ['Abyssinia', 'Ateng', 'Gayo 1', 'Gayo 2', 'Tim Tim'],
  process: { ko: '내추럴', en: 'Natural / dry process' },
  flavorNotes: { ko: ['파파야', '발효 바나나', '스파이스드 럼', '삼나무'], en: ['Papaya', 'Fermented banana', 'Spiced rum', 'Cedar'] },
  sources: [source('Sumatra Dry Process Ribang Gayo', 'https://www.sweetmarias.com/collections/southeast-asia-coffee-shrub/products/sumatra-dry-process-ribang-gayo-8331', 'Sweet Maria’s')],
};

const lintong: OriginSpecialtyLot = {
  name: 'Lintong Wet Hulled — P612744-2',
  producer: 'Lintong Nihuta smallholders / Rumani Hutasoit',
  location: 'Lintong Nihuta, North Sumatra',
  varieties: ['Ateng', 'Jember', 'Sigarar Utang'],
  process: { ko: '웻헐드', en: 'Wet hulled' },
  flavorNotes: { ko: ['라임', '홉', '녹차', '소나무'], en: ['Lime', 'Hops', 'Green tea', 'Pine'] },
  harvest: '2023/24',
  sources: [source('Indonesia Sumatra Lintong Wet-Hulled', 'https://www.covoyacoffee.com/p612744-2-indonesia-sumatra-lintong-wethulled.html', 'Covoya')],
};

const lintongAged: OriginSpecialtyLot = {
  name: 'Lintong — 5 Year Vintage 8679',
  producer: 'Lintong collectors, including Pak Keiza and Ibu Mega',
  location: 'Lintong Nihuta, North Sumatra',
  varieties: ['Ateng', 'Bergendal', 'Djember', 'Typica'],
  process: { ko: '웻헐드 후 5년 숙성', en: 'Wet hulled, then aged for five years' },
  flavorNotes: { ko: ['갈색 향신료', '파이프 담배', '삼나무', '무가당 코코아'], en: ['Brown spices', 'Pipe tobacco', 'Cedar', 'Unsweetened cocoa'] },
  harvest: '2021',
  sources: [source('Sumatra Aged Lintong — 5 Year Vintage', 'https://www.sweetmarias.com/collections/sumatra/products/sumatra-aged-lintong-5-year-vintage-8679?_fid=dab37de3c&_pos=1&_ss=c', 'Sweet Maria’s')],
};

const kayumas: OriginSpecialtyLot = {
  name: 'Java Kayumas — Natural',
  producer: 'Koperasi Surya Abada Kayumas',
  location: 'Kayumas, Java',
  varieties: ['S795', 'USDA 762'],
  process: { ko: '내추럴', en: 'Natural' },
  flavorNotes: { ko: ['파파야', '검은 포도', '키위', '요거트'], en: ['Papaya', 'Black grapes', 'Kiwi', 'Yoghurt'] },
  sources: [source('Java Kayumas', 'https://drwakefield.com/coffees/java-kayumas/', 'DRWakefield')],
};

const frinsaWashed: OriginSpecialtyLot = {
  name: 'Frinsa Sarapan #2',
  producer: 'Wildan and Atieq Mustofa / Frinsa Estate',
  location: 'Weninggalih, West Java',
  varieties: ['Sigarar Utang'],
  process: { ko: '워시드', en: 'Washed' },
  flavorNotes: { ko: ['자두', '다크 초콜릿', '쿠키차'], en: ['Plum', 'Dark chocolate', 'Kukicha tea'] },
  sources: [source('Frinsa Sarapan #2 — Indonesia', 'https://fountainrockcoffee.co.uk/collections/our-speciality-coffees/products/frinsa-sarapan-indonesia', 'Fountain Rock Coffee')],
};

const frinsaNatural: OriginSpecialtyLot = {
  name: 'Frinsa Edun #2 — 72 Hours Fermentation',
  producer: 'Wildan and Atieq Mustofa / Frinsa Estate',
  location: 'West Java',
  varieties: ['Ateng Super', 'P88', 'Borbor', 'Andungsar', 'Sigarar Utang', 'S795'],
  process: { ko: '락토바실루스 72시간 무산소 발효 내추럴', en: 'Natural with 72-hour anaerobic Lactobacillus fermentation' },
  flavorNotes: { ko: ['블랙 체리', '석류', '구운 코코넛', '카카오 닙스'], en: ['Black cherry', 'Pomegranate', 'Roasted coconut', 'Cacao nibs'] },
  harvest: '2024',
  sources: [source('Frinsa Edun #2 — 72 Hours Fermentation', 'https://paris-coffee-roasting-university.com/index.php/frinsa-edun-2-72-hours-fermentation/', 'Paris Coffee Roasting University')],
};

const frinsaTrade = source('What makes our Indonesian coffee so special?', 'https://www.nordicapproach.no/post/what-makes-our-indonesian-coffee-so-special', 'Nordic Approach');
const sulotcoSource = source('Produk — Toraja Coffee', 'https://toraja.coffee/id/produk/', 'PT Sulotco Jaya Abadi');
const torajaTrade = source('10% Off Green Coffee — Sulawesi Toraja Sapan Minanga 34621', 'https://royalcoffee.com/10-off-green-coffee/', 'Royal Coffee');

const sulotcoWashed: OriginSpecialtyLot = {
  name: 'Sulotco Toraja — Washed Dry Hull',
  producer: 'PT Sulotco Jaya Abadi',
  location: 'Rantekarua, Toraja, South Sulawesi',
  varieties: ['S795', 'Catuai'],
  process: { ko: '워시드·건식 탈곡', en: 'Washed, dry hulled' },
  flavorNotes: { ko: ['말린 과일', '자두', '흑설탕', '향신료'], en: ['Dried fruit', 'Plum', 'Brown sugar', 'Spices'] },
  sources: [sulotcoSource],
};

const sulotcoNatural: OriginSpecialtyLot = {
  name: 'Sulotco Toraja — Natural',
  producer: 'PT Sulotco Jaya Abadi',
  location: 'Rantekarua, Toraja, South Sulawesi',
  varieties: ['S795', 'Catuai'],
  process: { ko: '내추럴', en: 'Natural' },
  flavorNotes: { ko: ['바나나', '파인애플', '사과', '풋배'], en: ['Banana', 'Pineapple', 'Apple', 'Green pear'] },
  sources: [sulotcoSource],
};

const lagaLizu: OriginSpecialtyLot = {
  name: 'Flores Laga Lizu — Anaerobic Honey',
  producer: 'Wolo Wio smallholders / Laga Lizu',
  location: 'Wolo Wio, Bajawa, Ngada, Flores',
  varieties: ['S795'],
  process: { ko: '무산소 발효 허니', en: 'Anaerobic honey' },
  flavorNotes: { ko: ['멜론', '키위', '오렌지'], en: ['Melon', 'Kiwi', 'Orange'] },
  sources: [source('Flores Laga Lizu Anaerobic Honey', 'https://sucafina.com/na/offerings/flores-laga-lizu-anaerobic-honey', 'Sucafina')],
};

const nolaWonga: OriginSpecialtyLot = {
  name: 'Nola Wonga — Fully Washed',
  producer: 'Nola Wonga Farmers Group / Felix Soba',
  location: 'Wolowio, Bajawa, Ngada, Flores',
  varieties: ['S795'],
  process: { ko: '풀리 워시드', en: 'Fully washed' },
  flavorNotes: { ko: ['엘더플라워', '포멜로', '아가베 시럽'], en: ['Elderflower', 'Pomelo', 'Agave syrup'] },
  sources: [source('Indonesia — Nola Wonga', 'https://indochinacoffee.com/coffee/indonesia-nola-wonga-2024/', 'Indochina Coffee')],
};

const konkua: OriginSpecialtyLot = {
  name: 'Konkua Organic — P118342/1',
  producer: 'Konkua Organic Cooperative',
  location: 'Eastern Highlands, Papua New Guinea',
  varieties: ['Typica', 'Arusha', 'Mundo Novo'],
  process: { ko: '풀리 워시드', en: 'Fully washed' },
  flavorNotes: { ko: ['육두구', '초콜릿', '감귤', '감칠맛'], en: ['Nutmeg', 'Chocolate', 'Citrus', 'Savory'] },
  sources: [source('Papua New Guinea — Konkua Organic', 'https://www.ictcoffee.com/product/papua-new-guinea-18376/', 'ICT Coffee')],
};

const baroida: OriginSpecialtyLot = {
  name: 'Baroida Estate (Morita) — Washed',
  producer: 'Colbran Coffee Lands',
  location: 'Kainantu, Eastern Highlands, Papua New Guinea',
  varieties: ['Arusha'],
  process: { ko: '워시드', en: 'Washed' },
  flavorNotes: { ko: ['오렌지', '체리', '흑설탕', '아몬드'], en: ['Orange', 'Cherry', 'Brown sugar', 'Almond'] },
  harvest: '2025–2026',
  sources: [source('[BEANS] Single Origin Papua New Guinea (Washed)', 'https://shop.zhyvagocoffeeroastery.coffee/products/beans-single-origin-papua-new-guinea-washed', 'ZHYVAGO Coffee Roastery')],
};

const mongWashed: OriginSpecialtyLot = {
  name: 'Mong — Washed',
  producer: 'Rexson Raguni / Mong Coffee',
  location: 'Western Highlands, Papua New Guinea',
  varieties: ['Blue Mountain', 'Mundo Novo', 'Caturra'],
  process: { ko: '워시드', en: 'Washed' },
  flavorNotes: { ko: ['배', '콜라', '레몬그라스'], en: ['Pear', 'Cola', 'Lemongrass'] },
  sources: [source('Mong', 'https://enjoycoffeeroasters.com/products/mong', 'Enjoy Coffee Roasters')],
};

const mongNatural: OriginSpecialtyLot = {
  name: 'Rexson Raguni — Papua New Guinea Natural',
  producer: 'Rexson Raguni / Mong Coffee',
  location: 'Western Highlands, Papua New Guinea',
  varieties: ['Blue Mountain', 'Caturra', 'Mundo Novo'],
  process: { ko: '내추럴', en: 'Natural' },
  flavorNotes: { ko: ['다크 체리', '라즈베리', '초콜릿', '리치'], en: ['Dark cherry', 'Raspberry', 'Chocolate', 'Lychee'] },
  sources: [source('Rexson Raguni — Papua New Guinea — Natural', 'https://www.dandycoffee.ca/shop/p/rexson-raguni-png-natural', 'Dandy Coffee')],
};

const mongTrade = source('Mong Coffee', 'https://www.croptocup.com/community/mong-coffee/?community=161735', 'Crop to Cup');

const kerehaklu: OriginSpecialtyLot = {
  name: 'Kerehaklu Estate — Blossom Culture',
  producer: 'Pranoy Thipaiah / Kerehaklu Estate',
  location: 'Chikmagalur, Karnataka',
  varieties: ['Selection 9'],
  process: { ko: '커피꽃 배양액을 이용한 71시간 무산소 발효 내추럴', en: 'Anoxic natural with a coffee-blossom starter culture, 71 hours' },
  flavorNotes: { ko: ['딸기', '오렌지꽃', '석류', '선 멜론'], en: ['Strawberry', 'Orange blossom', 'Pomegranate', 'Sun melon'] },
  sources: [source('Kerehaklu Estate — Blossom Culture', 'https://bluetokaicoffee.com/products/kerehaklu-estate-blossom-culture', 'Blue Tokai Coffee Roasters')],
};

const ratnagiri: OriginSpecialtyLot = {
  name: 'Ratnagiri — Vacuum Process Cauvery Natural',
  producer: 'Ashok Patre / Ratnagiri Estate',
  location: 'Line Patte block, Bababudangiri, Chikmagalur, Karnataka',
  varieties: ['Cauvery'],
  process: { ko: '효모를 더한 56시간 진공 발효 내추럴', en: 'Natural with 56-hour yeast-assisted vacuum fermentation' },
  flavorNotes: { ko: ['자두', '크리스마스 케이크', '라임', '크리미한 질감'], en: ['Plum', 'Christmas cake', 'Lime', 'Creamy'] },
  harvest: '2024/25',
  sources: [source('India Ratnagiri Vacuum Process Cauvery from Bababudangiri', 'https://uk.covoyacoffee.com/india-ratnagiri-vacuum-process-nano.html', 'Covoya')],
};

const ratnagiriWashed: OriginSpecialtyLot = {
  name: 'Ratnagiri Estate — Double Washed Classic',
  producer: 'Ashok Patre / Ratnagiri Estate',
  location: 'Bababudangiri, Chikmagalur, Karnataka',
  varieties: [],
  process: { ko: '두 차례 발효·세척한 더블 워시드', en: 'Double washed with two fermentation and washing stages' },
  flavorNotes: { ko: ['감귤꽃', '감초', '구운 피칸', '티로즈'], en: ['Citrus blossom', 'Licorice', 'Roasted pecan', 'Tea rose'] },
  sources: [source('Ratnagiri Estate — Double Washed Classic', 'https://naivo.in/product/ratnagiri-estate-double-washed-classic/', 'Naivo Coffee Company')],
};

const kogilahalla: OriginSpecialtyLot = {
  name: 'Kogilahalla — Kent Microlot',
  producer: 'Kogilahalla Estate / Agastya Coffee',
  location: 'North Coorg, Karnataka',
  varieties: ['Kent'],
  process: { ko: '짧은 사전 발효를 거친 내추럴', en: 'Natural, sun dried after a short pre-fermentation' },
  flavorNotes: { ko: ['오렌지 사탕', '베리'], en: ['Orange candy', 'Berries'] },
  sources: [source('Kent Microlot — Arabica', 'https://www.agastyacoffee.com/product-page/kent-microlot', 'Agastya Coffee')],
};

const sandalkad: OriginSpecialtyLot = {
  name: 'Sandalkad — Flavour of India 2019',
  producer: 'Faisal Siddique / Sandalkad Estate',
  location: 'Coorg, Karnataka',
  varieties: ['CxR'],
  process: { ko: '워시드 로부스타', en: 'Washed Robusta' },
  flavorNotes: { ko: ['삼나무', '초콜릿', '허브'], en: ['Cedar', 'Chocolate', 'Herbal'] },
  sources: [source('Flavour of India — The Fine Cup Award 2019: Winning Coffees', 'https://hcikl.gov.in/pdf/Winning_Coffees_Brochure.pdf', 'Coffee Board of India')],
};

const luna: OriginSpecialtyLot = {
  name: 'Luna — Robusta Naturals',
  producer: 'Thomas / Black Baza Coffee grower network',
  location: 'Wayanad, Kerala',
  varieties: [],
  process: { ko: '햇볕 건조 내추럴', en: 'Natural, sun dried' },
  flavorNotes: { ko: ['다크 초콜릿', '담배', '향신료'], en: ['Dark chocolate', 'Tobacco', 'Spice'] },
  sources: [source('Luna — Robusta Naturals', 'https://www.blackbazacoffee.com/products/luna', 'Black Baza Coffee')],
};

const radar: OriginSpecialtyLot = {
  name: 'Radar Farms — THA-1 Reserve',
  producer: 'Anh Dũng / Radar Farm',
  location: 'Cầu Đất, Lâm Đồng',
  varieties: ['THA1'],
  process: { ko: '소금을 사용한 무산소 발효 내추럴', en: 'Natural with anaerobic fermentation using salt' },
  flavorNotes: { ko: ['복숭아차', '사탕수수', '시럽 같은 질감'], en: ['Peach tea', 'Sugarcane', 'Syrupy mouthfeel'] },
  sources: [source('Radar Farms — THA-1 Reserve', 'https://chau-coffee.com/products/radar-farms-tha-1-reserve', 'Chau Coffee')],
};

const marriedBeans: OriginSpecialtyLot = {
  name: 'Arabica Cầu Đất G1 — Fully Washed',
  producer: 'The Married Beans / Cầu Đất partner farmers',
  location: 'Cầu Đất, Lâm Đồng',
  varieties: ['Catimor'],
  process: { ko: '풀리 워시드', en: 'Fully washed' },
  flavorNotes: { ko: ['초콜릿', '견과류', '사탕수수', '사과'], en: ['Chocolate', 'Nutty', 'Sugarcane', 'Apple'] },
  sources: [source('Cầu Đất — Green Coffee', 'https://www.themarriedbeans.com/en/products/ca-phe-nhan-xanh-cau-dat', 'The Married Beans')],
};

const radarTrade = source('Giving you a taste of Vietnam’s finest coffees', 'https://thecoffeevine.com/blog/giving-you-a-taste-of-vietnams-finest-coffees/', 'The Coffeevine');

const hoaThuan: OriginSpecialtyLot = {
  name: 'Hoà Thuận Fine Robusta — Crop of Bravery 2024',
  producer: 'Đạm Coffee Farm / Every Half',
  location: 'Hoà Thuận, Buôn Ma Thuột, Đắk Lắk',
  varieties: ['Cà Sẻ'],
  process: { ko: '모스토 내추럴', en: 'Mosto natural' },
  flavorNotes: { ko: ['홍차', '꿀', '땅콩', '흑설탕'], en: ['Black tea', 'Honey', 'Peanut', 'Brown sugar'] },
  harvest: '2024',
  sources: [
    source('New Crop 2024 — Crop of Bravery', 'https://www.everyhalf.vn/post/4cc48115', 'Every Half Coffee Roasters'),
    source('Crop of Bravery — Hương vị cà phê quê hương', 'https://www.everyhalf.vn/post/crop-of-bravery-h%C6%B0%C6%A1ng-v%E1%BB%8B-c%C3%A0-ph%C3%AA-qu%C3%AA-h%C6%B0%C6%A1ng', 'Every Half Coffee Roasters'),
  ],
};

const harazNatural: OriginSpecialtyLot = {
  name: 'Sharqi Haraz — Anaerobic Natural CJ1645',
  producer: 'Sharqi Haraz Cooperative / Pearl of Tehama',
  location: 'Eastern Haraz, Sana’a Governorate',
  varieties: ['Jadi', 'Dawaery', 'Tuffahi', 'Jufini'],
  process: { ko: '무산소 발효 내추럴', en: 'Anaerobic natural' },
  flavorNotes: { ko: ['퍼지 브라우니', '콜라', '무화과', '석류'], en: ['Fudge brownie', 'Cola', 'Fig', 'Pomegranate'] },
  harvest: '2024/25',
  sources: [source('Crown Jewel Yemen Anaerobic Natural Sharqi Haraz Cooperative CJ1645', 'https://cdn.royalcoffee.com/wp-content/uploads/2025/10/20193140/Crown-Jewel-Yemen-Anaerobic-Natural-Sharqi-Haraz-Cooperative-CJ1645.pdf', 'Royal Coffee')],
};

const harazWashed: OriginSpecialtyLot = {
  name: 'Sharqi Haraz — Washed CJ1677 / 39817-1',
  producer: 'Sharqi Haraz Cooperative / Pearl of Tehama',
  location: 'Eastern Haraz, Sana’a Governorate',
  varieties: ['Ja’adi', 'Dawairi'],
  process: { ko: '과육 제거·발효·세척 후 건조대에서 15–20일 건조한 워시드', en: 'Washed, dried on raised beds for 15–20 days after depulping, fermentation and washing' },
  flavorNotes: { ko: ['오렌지꽃', '청포도', '다크 체리', '홍차'], en: ['Orange blossom', 'Green grape', 'Dark cherry', 'Black tea'] },
  harvest: 'October–February 2026',
  sources: [source('Crown Jewel Yemen Washed Sharqi Haraz Cooperative CJ1677', 'https://cdn.royalcoffee.com/wp-content/uploads/2026/06/15164206/Crown-Jewel-Yemen-Washed-Sharqi-Haraz-Cooperative-CJ1677.pdf', 'Royal Coffee')],
};

const mattari: OriginSpecialtyLot = {
  name: 'Ameer Al-Matari — Udaini Lot 205',
  producer: 'Ameer Al-Matari',
  location: 'Al-Qudamah village, Bani Matar',
  varieties: ['Udaini'],
  process: { ko: '140시간 무산소 발효 후 45일 저속 건조', en: '140-hour anaerobic fermentation, followed by 45-day slow drying' },
  flavorNotes: { ko: ['건포도', '프룬', '레드 와인', '흑설탕'], en: ['Raisin', 'Prune', 'Red wine', 'Brown sugar'] },
  sources: [source('Yemen Udaini Ameer Al-Matari Lot 205 Anaerobic 45 Days Slow Dry', 'https://www.coffee-tech.co.nz/product/yemen-udaini-ameer-al-matari-lot-205/', 'Coffee Tech')],
};

const asman2025: OriginSpecialtyLot = {
  name: 'Asman Gayo — Natural 2025',
  producer: 'Asman Arianto / Asman Gayo Mill',
  location: 'Pegasing, Takengon, Aceh, Sumatra',
  varieties: ['Ateng', 'Bor Bor', 'Catimor', 'Timor'],
  process: { ko: '내추럴', en: 'Natural' },
  flavorNotes: { ko: ['적포도', '허니듀 멜론', '과일 펀치'], en: ['Red grapes', 'Honeydew', 'Fruit punch'] },
  harvest: '2025',
  sources: [source('Asman Gayo', 'https://www.suedhang.org/en/product/asman-gayo/', 'SUEDHANG', '2026-09-09')],
};

const frinsa2025: OriginSpecialtyLot = {
  name: 'Java Frinsa Estate — Natural 2025',
  producer: 'Wildan Mustofa and Atieq Mustikaningtyas / Frinsa Estate',
  location: 'Weninggalih, Riung Gunung, West Java',
  varieties: ['P88', 'S795', 'Andung Sari', 'Borbor'],
  process: { ko: '체리 상태에서 발효·건조한 내추럴', en: 'Natural, fermented and dried as whole cherry' },
  flavorNotes: { ko: ['복숭아', '꿀', '블루베리', '만다린', '밀크 초콜릿'], en: ['Peach', 'Honey', 'Blueberry', 'Mandarin', 'Milk chocolate'] },
  harvest: '2025',
  sources: [source('Indonesia — Java Frinsa Estate | Natural', 'https://roguewavecoffee.ca/products/indonesia-java-frinsa-estate-natural', 'Rogue Wave Coffee', '2026-09-09')],
};

const bajawa2025: OriginSpecialtyLot = {
  name: 'Bajawa Forest Coffee — JYN Fully Washed 2025/2026',
  producer: 'JYN Group Indonesia / collective coffee growers',
  location: 'Bajawa, Flores',
  varieties: ['S795'],
  process: { ko: '풀리 워시드', en: 'Fully washed' },
  flavorNotes: { ko: ['리치', '재스민', '자두', '초콜릿'], en: ['Lychee', 'Jasmine', 'Plum', 'Chocolate'] },
  harvest: '2025/2026',
  sources: [source('Bajawa Forest Coffee — JYN — Fully Washed', 'https://www.lbfgroupitalia.com/en/indonesia-bajawa-forest-coffee---fully-washed.c499', 'LBF Group Italia', '2026-09-09')],
};

const buntuLedo2025: OriginSpecialtyLot = {
  name: 'Toraja Buntu Ledo — Natural ID25-TBL-A-N',
  producer: 'Koperasi Buntu Ledo Sipporanu / Ontosoroh',
  location: 'Buntu Ledo, Toraja, South Sulawesi',
  varieties: [],
  process: { ko: '내추럴', en: 'Natural' },
  flavorNotes: { ko: ['망고', '파인애플', '꿀', '넥타린'], en: ['Mango', 'Pineapple', 'Honey', 'Nectarine'] },
  harvest: '2025',
  sources: [
    source('Toraja Buntu Ledo', 'https://thissideup.coffee/torajabuntuledo', 'This Side Up', '2026-09-09'),
    source('Toraja Buntu Ledo — natural — ID25-TBL-A-N / TS-01061193', 'https://app.tastify.com/sample-report/daf44b73-7c27-4840-9f9d-6f9462f1df34?id=891e0d6b-3c88-4b1c-9234-46922b7f03bb', 'This Side Up / Tastify', '2026-09-09'),
  ],
};

const ratnagiri2026: OriginSpecialtyLot = {
  name: 'Ratnagiri Estate — Washed P8003180-1',
  producer: 'Ashok Patre / Ratnagiri Estate',
  location: 'Bababudangiri, Western Ghats, Karnataka',
  varieties: [],
  process: { ko: '워시드', en: 'Washed' },
  flavorNotes: { ko: ['토피 애플', '설타나 건포도', '호두'], en: ['Toffee apple', 'Sultana', 'Walnut'] },
  harvest: '2025/26',
  sources: [source('India Ratnagiri Estate Washed — P8003180-1', 'https://eu.covoyacoffee.com/origins/asia-pacific-islands/india-ratnagiri-estate-ab-eu.html', 'Covoya', '2026-09-09')],
};

const harangal2025: OriginSpecialtyLot = {
  name: 'Harangal Estate — Fermented Washed 2025',
  producer: 'M. C. Kariappa / Harangal Estate / Kaad Kaapi',
  location: 'Madapur, Coorg, Karnataka',
  varieties: ['Chandragiri'],
  process: { ko: '과육 제거 후 18시간 수중 발효·세척, 그늘에서 10일 건조', en: 'Depulped, fermented in water for 18 hours, washed and shade-dried for ten days' },
  flavorNotes: { ko: ['히비스커스', '빨간 사과', '솜사탕'], en: ['Hibiscus', 'Red apple', 'Cotton candy'] },
  harvest: 'February 2025',
  sources: [source('Harangal Estate — Fermented Washed', 'https://gshotcoffeeroastery.com/collections/speciality-coffee/products/harangal-estate-washed', 'GShot Coffee Roastery', '2026-09-09')],
};

const biowin2026: OriginSpecialtyLot = {
  name: 'Kerala Cherry A — P11792',
  producer: 'Biowin Agro Research / Wayanad smallholders',
  location: 'Wayanad, Kerala',
  varieties: [],
  process: { ko: '체리 상태로 건조 후 탈곡한 내추럴', en: 'Natural, dried as whole cherry and then hulled' },
  flavorNotes: { ko: ['코코아', '구운 헤이즐넛', '갈색 향신료'], en: ['Cocoa', 'Roasted hazelnut', 'Brown spice'] },
  harvest: '2026',
  sources: [source('India Kerala Cherry A — P11792', 'https://www.touton-specialty-coffee.com/en/p11792', 'Touton Specialty Coffee', '2026-09-09')],
};

const nuiMin2026: OriginSpecialtyLot = {
  name: 'Núi Min — Washed 2025–2026',
  producer: 'Núi Min growers / Hồ Phượng processing mill',
  location: 'Núi Min, Cầu Đất, Lâm Đồng',
  varieties: ['Catimor'],
  process: { ko: 'Hồ Phượng 가공장의 워시드', en: 'Washed at the Hồ Phượng processing mill' },
  flavorNotes: { ko: ['흑설탕', '캐모마일 차', '포멜로 껍질'], en: ['Brown sugar', 'Chamomile tea', 'Pomelo zest'] },
  harvest: '2025–2026',
  sources: [source('Cà phê Núi Min Sơ chế ướt mùa vụ 2025–2026', 'https://visty.vn/san-pham/mountain-soul-ca-phe-nui-min/', 'Visty', '2026-09-09')],
};

const nong: OriginSpecialtyLot = {
  name: 'Nồng — Soulful Collection 2026',
  producer: 'Soul Specialty Coffee',
  location: 'Buôn Ma Thuột, Đắk Lắk',
  varieties: ['Robusta TR'],
  process: { ko: 'Soul 배양 효모로 발효한 내추럴', en: 'Natural, fermented with Soul yeast' },
  flavorNotes: { ko: ['구아바', '아몬드', '구운 코코넛', '캐러멜'], en: ['Guava', 'Almond', 'Roasted coconut', 'Caramel'] },
  sources: [source('Nồng — Fine Robusta TR — Natural — Soul Yeast | Soulful Collection 2026', 'https://soulcoffee.vn/products/soulful2025-nong-espresso-fine-ro-top7-vietnam-coffee-producer', 'Soul Specialty Coffee', '2026-09-09')],
};

const mattariAli: OriginSpecialtyLot = {
  name: 'Bayt Al-Razqi — Ali Naji',
  producer: 'Ali Naji',
  location: 'Bayt Al-Razqi village, Bani Matar, Sana’a',
  varieties: [],
  process: { ko: '그늘에서 20–25일 저속 건조한 내추럴', en: 'Natural, slow-dried in shade for 20–25 days' },
  flavorNotes: { ko: ['잘 익은 베리', '꽃', '열대과일'], en: ['Ripe berries', 'Flowers', 'Tropical fruit'] },
  sources: [source('Village Bayt Al-Razqi — Yemen Coffee', 'https://cafe-torifa.fr/en/products/cafe-yemen-al-haymah-al-kharijiyah-copy-1', 'TORIFA', '2026-09-09')],
};

const mattariSaih: OriginSpecialtyLot = {
  name: 'Bani Matar — Saih Village Natural',
  producer: 'Saih village smallholders',
  location: 'Saih village, Bani Matar',
  varieties: ['Udain', 'Dawayri'],
  process: { ko: '건조대에서 말린 내추럴', en: 'Natural, dried on raised beds' },
  flavorNotes: { ko: ['꽃', '과일', '향신료', '레몬'], en: ['Floral', 'Fruity', 'Spicy', 'Lemon'] },
  sources: [source('Yemen | Bani Matar | SCA 86', 'https://qahwahclub.com/products/yemen-bani-matar', 'Qahwah Club', '2026-09-09')],
};

const arinagataRoast: OriginSpecialtyLot = {
  "name": "Arinagata — Gayo 1 Semi Washed",
  "producer": "Arinagata Cooperative",
  "location": "Central Aceh, Gayo, Sumatra",
  "varieties": [
    "Gayo 1"
  ],
  "process": {
    "ko": "세미 워시드",
    "en": "Semi washed"
  },
  "flavorNotes": {
    "ko": [
      "백포도",
      "바닐라",
      "꽃",
      "향신료"
    ],
    "en": [
      "White grape",
      "Vanilla",
      "Floral",
      "Spices"
    ]
  },
  "sources": [
    {
      "title": "Arinagata — Gayo 1 Semi Washed",
      "url": "https://nusacoffeecompany.com/products/sumatra-gayo",
      "publisher": "Nusa Coffee",
      "accessedAt": "2026-09-09"
    }
  ]
};

const lintongRoast: OriginSpecialtyLot = {
  "name": "Lintong — Jejak Toba Full Washed",
  "producer": "Coffee TGC (roaster)",
  "location": "Lintong Nihuta, North Sumatra",
  "varieties": [
    "Line S"
  ],
  "process": {
    "ko": "풀 워시드",
    "en": "Fully washed"
  },
  "flavorNotes": {
    "ko": [
      "견과류",
      "흑설탕",
      "꽃",
      "캐러멜"
    ],
    "en": [
      "Nuts",
      "Brown sugar",
      "Floral",
      "Caramel"
    ]
  },
  "sources": [
    {
      "title": "Lintong — Jejak Toba Full Washed",
      "url": "https://coffeetgc.com/2021/03/25/lintong/",
      "publisher": "Coffee TGC",
      "accessedAt": "2026-09-09"
    }
  ]
};

const frinsaCollectiveRoast: OriginSpecialtyLot = {
  "name": "Frinsa Collective — Lactobacillus Washed",
  "producer": "Frinsa Collective smallholders / Wildan Mustofa and Atieq Mustikaningtyas",
  "location": "West Java",
  "varieties": [
    "Borbor",
    "Lini S",
    "Ateng Super",
    "Timor",
    "Sigarar Utang",
    "P88"
  ],
  "process": {
    "ko": "유산균 배양액 발효 워시드",
    "en": "Lactobacillus fermented washed"
  },
  "flavorNotes": {
    "ko": [
      "녹차",
      "레몬그라스",
      "크랜베리"
    ],
    "en": [
      "Green tea",
      "Lemongrass",
      "Cranberry"
    ]
  },
  "sources": [
    {
      "title": "Frinsa Collective — Lactobacillus Washed",
      "url": "https://www.horshamcoffeeroaster.co.uk/products/west-java-frinsa-collective-fermented-washed",
      "publisher": "Horsham Coffee Roaster",
      "accessedAt": "2026-09-09"
    }
  ]
};

const beiposoRoast: OriginSpecialtyLot = {
  "name": "Beiposo — S795 Full Washed",
  "producer": "Beiposo village women farmers",
  "location": "Beiposo, Bajawa, Flores",
  "varieties": [
    "S795"
  ],
  "process": {
    "ko": "풀 워시드",
    "en": "Fully washed"
  },
  "flavorNotes": {
    "ko": [
      "레몬그라스",
      "청사과",
      "흑설탕",
      "시나몬"
    ],
    "en": [
      "Lemongrass",
      "Green apple",
      "Brown sugar",
      "Cinnamon"
    ]
  },
  "sources": [
    {
      "title": "Beiposo — S795 Full Washed",
      "url": "https://nusacoffeecompany.com/products/flores-bajawa",
      "publisher": "Nusa Coffee",
      "accessedAt": "2026-09-09"
    }
  ]
};

const wongawaliRoast: OriginSpecialtyLot = {
  "name": "UPH Wongawali — Giling Basah",
  "producer": "UPH Wongawali",
  "location": "Bajawa, Ngada, Flores",
  "varieties": [
    "Typica",
    "Catimor",
    "S795"
  ],
  "process": {
    "ko": "웻헐드",
    "en": "Wet hulled (Giling Basah)"
  },
  "flavorNotes": {
    "ko": [
      "꿀",
      "초콜릿",
      "노란 과일"
    ],
    "en": [
      "Honey",
      "Chocolate",
      "Yellow fruit"
    ]
  },
  "sources": [
    {
      "title": "UPH Wongawali — Giling Basah",
      "url": "https://www.sanagustin.com/en/product/bajawa/",
      "publisher": "San Agustín",
      "accessedAt": "2026-09-09"
    }
  ]
};

const baroidaGeshaRoast: OriginSpecialtyLot = {
  "name": "Baroida Estate — Geisha Washed",
  "producer": "Colbran family / Baroida Estate",
  "location": "Eastern Highlands, Papua New Guinea",
  "varieties": [
    "Geisha"
  ],
  "process": {
    "ko": "워시드",
    "en": "Washed"
  },
  "flavorNotes": {
    "ko": [
      "만다린",
      "핵과류",
      "홍차",
      "재스민"
    ],
    "en": [
      "Mandarin",
      "Stone fruit",
      "Black tea",
      "Jasmine"
    ]
  },
  "sources": [
    {
      "title": "Baroida Estate — Geisha Washed",
      "url": "https://gabrielcoffee.com.au/products/baroida-estate-papua-new-guinea-espresso-500g",
      "publisher": "Gabriel Coffee",
      "accessedAt": "2026-09-09"
    }
  ]
};

const mongEnjoyRoast: OriginSpecialtyLot = {
  "name": "Mong — Slow Dried Washed (Enjoy)",
  "producer": "Rexson Raguni / Mong Coffee",
  "location": "Western Highlands, Papua New Guinea",
  "varieties": [
    "Blue Mountain",
    "Mundo Novo",
    "Caturra"
  ],
  "process": {
    "ko": "그늘에서 천천히 건조한 워시드",
    "en": "Washed, slow dried under shade"
  },
  "flavorNotes": {
    "ko": [
      "배",
      "콜라",
      "레몬그라스"
    ],
    "en": [
      "Pear",
      "Cola",
      "Lemongrass"
    ]
  },
  "sources": [
    {
      "title": "Mong — Slow Dried Washed (Enjoy)",
      "url": "https://enjoycoffeeroasters.com/products/mong",
      "publisher": "Enjoy Coffee Roasters",
      "accessedAt": "2026-09-09"
    }
  ]
};

const kerehakluS10Roast: OriginSpecialtyLot = {
  "name": "Kerehaklu — SLN10 Mosto Culture Washed",
  "producer": "Kerehaklu Estate",
  "location": "Chikmagalur, Karnataka",
  "varieties": [
    "SLN10"
  ],
  "process": {
    "ko": "모스토 배양액을 이용한 2단계 발효 워시드",
    "en": "Two-stage mosto culture washed"
  },
  "flavorNotes": {
    "ko": [
      "허브",
      "다크 체리",
      "헤이즐넛",
      "자두"
    ],
    "en": [
      "Herbs",
      "Dark cherry",
      "Hazelnut",
      "Plum"
    ]
  },
  "sources": [
    {
      "title": "Kerehaklu — SLN10 Mosto Culture Washed",
      "url": "https://korerocoffee.com/products/kerehaklu-mosto-culture-washed",
      "publisher": "Korero Coffee Roasters",
      "accessedAt": "2026-09-09"
    }
  ]
};

const kerehakluAviaryRoast: OriginSpecialtyLot = {
  "name": "Kerehaklu — AVIARY 016 Lot E",
  "producer": "Ajoy and Pranoy Thipaiah / Kerehaklu Estate",
  "location": "Doddagandi Lower block, Chikmagalur, Karnataka",
  "varieties": [
    "Selection 9"
  ],
  "process": {
    "ko": "모스토 배양액 37시간 순차 발효 워시드",
    "en": "Washed, sequentially fermented with mosto culture for 37 hours"
  },
  "flavorNotes": {
    "ko": [
      "타마린드",
      "살구",
      "빨간 사과",
      "오렌지"
    ],
    "en": [
      "Tamarind",
      "Apricot",
      "Red apple",
      "Orange"
    ]
  },
  "sources": [
    {
      "title": "Kerehaklu — AVIARY 016 Lot E",
      "url": "https://aviary.coffee/products/016-kerehaklu",
      "publisher": "Aviary",
      "accessedAt": "2026-09-09"
    }
  ],
  "harvest": "2024-12-02"
};

const ratnagiriHoneyRoast: OriginSpecialtyLot = {
  "name": "Ratnagiri — El Sinvergüenza Cauvery Honey",
  "producer": "Ashok Patre / Ratnagiri Estate",
  "location": "Bababudangiri, Western Ghats, Karnataka",
  "varieties": [
    "Cauvery"
  ],
  "process": {
    "ko": "허니",
    "en": "Honey"
  },
  "flavorNotes": {
    "ko": [
      "멜론",
      "레모네이드",
      "바닐라 크림",
      "초콜릿 쿠키"
    ],
    "en": [
      "Melon",
      "Lemonade",
      "Vanilla cream",
      "Chocolate cookie"
    ]
  },
  "sources": [
    {
      "title": "Ratnagiri — El Sinvergüenza Cauvery Honey",
      "url": "https://cafeirreverentes.com/en/product/elsinverguenza/",
      "publisher": "IRREVERENTES",
      "accessedAt": "2026-09-09"
    }
  ]
};

const harangalNaturalRoast: OriginSpecialtyLot = {
  "name": "Harangal — Chandragiri Natural (Pinup)",
  "producer": "Petu Kariappa / Harangal Estate",
  "location": "Coorg, Karnataka",
  "varieties": [
    "Chandragiri"
  ],
  "process": {
    "ko": "내추럴",
    "en": "Natural"
  },
  "flavorNotes": {
    "ko": [
      "천도복숭아",
      "자두",
      "건포도",
      "캐러멜"
    ],
    "en": [
      "Nectarine",
      "Plum",
      "Raisin",
      "Caramel"
    ]
  },
  "sources": [
    {
      "title": "Harangal — Chandragiri Natural (Pinup)",
      "url": "https://www.pinupcoffeeco.com/products/india",
      "publisher": "Pinup Coffee",
      "accessedAt": "2026-09-09"
    }
  ]
};

const harazFusariRoast: OriginSpecialtyLot = {
  "name": "Haraz — Jadi & Jufni Natural",
  "producer": "Caffè Fusari (roaster)",
  "location": "Haraz, Yemen",
  "varieties": [
    "Jadi",
    "Jufni"
  ],
  "process": {
    "ko": "내추럴",
    "en": "Natural"
  },
  "flavorNotes": {
    "ko": [
      "자몽",
      "자두",
      "포도",
      "정향"
    ],
    "en": [
      "Grapefruit",
      "Plum",
      "Grape",
      "Clove"
    ]
  },
  "sources": [
    {
      "title": "Haraz — Jadi & Jufni Natural",
      "url": "https://www.caffefusari.it/en/product/yemen-da-tradurre-en",
      "publisher": "Caffè Fusari",
      "accessedAt": "2026-09-09"
    }
  ]
};

const mattariMuslotRoast: OriginSpecialtyLot = {
  "name": "Mocha Matari — Muslot Natural (LCC)",
  "producer": "Fatoum Muslot / Muslot coffee business",
  "location": "Bani Matar, Yemen",
  "varieties": [
    "Yemeni heirloom"
  ],
  "process": {
    "ko": "내추럴",
    "en": "Natural"
  },
  "flavorNotes": {
    "ko": [
      "대추야자",
      "말린 살구",
      "타마린드",
      "감초"
    ],
    "en": [
      "Date",
      "Dried apricot",
      "Tamarind",
      "Licorice"
    ]
  },
  "sources": [
    {
      "title": "Mocha Matari — Muslot Natural (LCC)",
      "url": "https://lccroastery.com/2020/05/15/yemen-mocha-matari/",
      "publisher": "LCC Roastery",
      "accessedAt": "2026-09-09"
    }
  ]
};

const caudatHoneyRoast: OriginSpecialtyLot = {
  "name": "Cầu Đất — Catimor Honey Red",
  "producer": "The Married Beans / Cầu Đất partner farmers",
  "location": "Cầu Đất, Xuân Trường, Đà Lạt, Lâm Đồng",
  "varieties": [
    "Catimor"
  ],
  "process": {
    "ko": "레드 허니",
    "en": "Red honey"
  },
  "flavorNotes": {
    "ko": [
      "향신료",
      "당밀",
      "다크 초콜릿",
      "핵과류"
    ],
    "en": [
      "Spices",
      "Molasses",
      "Dark chocolate",
      "Stone fruit"
    ]
  },
  "sources": [
    {
      "title": "Cầu Đất — Catimor Honey Red",
      "url": "https://www.themarriedbeans.com/en/pages/green-coffee-export",
      "publisher": "The Married Beans",
      "accessedAt": "2026-09-09"
    },
    {
      "title": "Arabica G1 — Honey processed — Cau Dat",
      "url": "https://www.themarriedbeans.com/en/products/ca-phe-nhan-xanh-honey",
      "publisher": "The Married Beans",
      "accessedAt": "2026-09-09"
    }
  ]
};

const profile = (
  regionId: string,
  priority: OriginSpecialtyProfile['priority'],
  rationale: string,
  lots: OriginSpecialtyLot[],
  additionalSources: OriginGuideSource[] = [],
): OriginSpecialtyProfile => ({
  regionId,
  priority,
  rationale,
  lots,
  sources: [...new Map([...lots.flatMap((lot) => lot.sources), ...additionalSources].map((item) => [item.url, item])).values()],
});

export const asiaSpecialtyProfiles: OriginSpecialtyProfile[] = [
  profile('indonesia-sumatra', 'focus', '가요와 린통의 서로 다른 생산자·가공 로트가 전문 수입사에서 반복 거래된다. Asman Gayo의 2025년 수확분이 별도 로스터에 기록돼 있다.', [ratu, lintong, asman2025, arinagataRoast]),
  profile('indonesia-java', 'focus', 'Kayumas 협동조합의 내추럴과 Frinsa의 워시드를 확인했다. 서부 자바 Frinsa의 장기 수입 관계와 2025년 수확 내추럴 로트가 명확하다.', [kayumas, frinsaWashed, frinsa2025, frinsaCollectiveRoast], [frinsaTrade]),
  profile('indonesia-sulawesi', 'focus', 'Sulotco의 가공별 상품과 Buntu Ledo 협동조합의 2025년 수확 로트가 확인된다. 현재 로트 근거는 남술라웨시 Toraja에 한정된다.', [sulotcoWashed, sulotcoNatural, buntuLedo2025], [torajaTrade]),
  profile('indonesia-flores', 'standard', 'Bajawa의 생산자 그룹과 허니·워시드 로트가 추적되며 JYN Group의 2025/2026 수확 표기도 확인된다. 근거가 섬 전역을 대표하지는 않아 보통 우선순위로 둔다.', [lagaLizu, nolaWonga, bajawa2025, beiposoRoast, wongawaliRoast]),
  profile('indonesia-gayo', 'focus', 'Ketiara 여성 협동조합, Ribang Gayo, Asman Gayo의 별도 로트가 확인된다. Asman의 2025년 수확 내추럴은 생산자·품종·향미를 함께 공개한다.', [ratu, ribang, asman2025, arinagataRoast]),
  profile('indonesia-lintong', 'focus', '서로 다른 수입사가 생산자 집하망을 밝힌 웻헐드와 의도적으로 숙성한 로트를 거래한다. 숙성 향미는 해당 2021년산 로트에만 귀속한다.', [lintong, lintongAged, lintongRoast]),
  profile('indonesia-west-java', 'focus', 'Frinsa의 장기 전문 수입 관계가 확인된다. 단일 품종 워시드, 2024년 발효 내추럴, 2025년 내추럴을 각각의 로트 자료로 확인했다.', [frinsaWashed, frinsaNatural, frinsa2025, frinsaCollectiveRoast], [frinsaTrade]),
  profile('indonesia-toraja', 'focus', 'Sulotco의 가공별 상품과 다른 생산단위인 Buntu Ledo 협동조합의 2025년 수확 내추럴을 확인했다. Buntu Ledo는 2026년 1월 개별 커핑 보고서도 공개한다.', [sulotcoWashed, sulotcoNatural, buntuLedo2025], [torajaTrade]),
  profile('indonesia-bajawa', 'standard', 'Wolowio의 두 생산자 그룹과 JYN Group의 2025/2026 워시드 로트를 확인했다. 추적 가능한 거래가 늘었지만 지역 전체의 반복 거래 폭은 제한적으로 확인돼 보통 우선순위로 둔다.', [lagaLizu, nolaWonga, bajawa2025, beiposoRoast, wongawaliRoast]),
  profile('papua-new-guinea-eastern-highlands', 'focus', 'Konkua 협동조합과 Baroida 농장의 별도 거래 로트가 확인된다. 협동조합 혼합 품종과 농장 Arusha 로트를 구분한다.', [konkua, baroida, baroidaGeshaRoast]),
  profile('papua-new-guinea-western-highlands', 'focus', 'Mong Coffee의 2024–2025년 수입 관계와 가공 개선이 수입사에 기록돼 있고 워시드·내추럴 로트가 별도 로스터에서 확인된다.', [mongWashed, mongNatural, mongEnjoyRoast], [mongTrade]),
  profile('india-karnataka', 'focus', 'Kerehaklu의 농장 단위 발효 로트, Ratnagiri의 2025/26 워시드, Coorg Sandalkad의 공식 파인컵 로부스타 출품 기록이 있어 아라비카와 로부스타를 함께 다룬다.', [kerehaklu, ratnagiri2026, sandalkad, kerehakluS10Roast, kerehakluAviaryRoast]),
  profile('india-kerala', 'standard', 'Wayanad Thomas의 Luna 내추럴과 Biowin 농가 조합의 2026년 수확 로트를 확인했다. 서로 다른 생산단위의 상품 근거는 있으나 그 자체로 대회 수준이나 지역 전체의 품질을 판정하지 않는다.', [luna, biowin2026]),
  profile('india-chikmagalur', 'focus', 'Kerehaklu의 커피꽃 배양 발효와 Ratnagiri의 진공 발효를 확인했다. Ratnagiri는 별도의 2025/26 워시드까지 여러 시즌 수입 기록이 이어진다.', [kerehaklu, ratnagiri, ratnagiri2026, kerehakluS10Roast, kerehakluAviaryRoast]),
  profile('india-bababudangiri', 'focus', 'Ratnagiri의 장기 전문 수입 관계, 구획·품종 지정 발효 로트, 더블 워시드, 2025/26 워시드가 각각 확인된다.', [ratnagiri, ratnagiriWashed, ratnagiri2026, ratnagiriHoneyRoast]),
  profile('india-coorg', 'focus', 'Kogilahalla Kent, Sandalkad의 2019년 공식 파인컵 로부스타, Harangal의 2025년 Chandragiri 워시드를 확인했다. 생산자와 가공·작황이 분리된 실제 로트들이다.', [kogilahalla, sandalkad, harangal2025, harangalNaturalRoast]),
  profile('india-wayanad', 'standard', 'Thomas의 Luna와 Biowin 농가 조합의 2026년 내추럴이 추적된다. 세부 로부스타 품종은 양쪽 모두 확정되지 않았으며 로트 추가만으로 우선순위를 높이지 않는다.', [luna, biowin2026]),
  profile('vietnam-da-lat', 'focus', 'Radar, The Married Beans, Hồ Phượng 가공장에 연결되는 Núi Min 2025–2026 워시드를 확인했다. 현재 세 로트의 생산지는 Đà Lạt 권역 안에서도 Cầu Đất에 한정된다.', [radar, marriedBeans, nuiMin2026, caudatHoneyRoast], [radarTrade]),
  profile('vietnam-buon-ma-thuot', 'standard', 'Đạm Coffee Farm과 Every Half의 Hoà Thuận 2024 모스토 내추럴, Soul의 별도 Nồng 내추럴 상품을 확인했다. Nồng은 지역·효모 가공·향미가 공개되지만 세부 농장과 수확연도는 미공개다.', [hoaThuan, nong]),
  profile('vietnam-cau-dat', 'focus', 'Radar THA1, The Married Beans Catimor, Núi Min 2025–2026 Catimor 워시드를 확인했다. 전문 거래와 생산단위별 가공 차이가 명확하다.', [radar, marriedBeans, nuiMin2026, caudatHoneyRoast], [radarTrade]),
  profile('yemen-haraaz', 'focus', 'Royal의 지속적인 Sharqi Haraz 조달 관계와 별도 분석된 무산소 내추럴·워시드 두 로트를 확인했다. 희소성이나 가격만으로 우선순위를 정하지 않는다.', [harazNatural, harazWashed, harazFusariRoast]),
  profile('yemen-mattari', 'standard', 'Al-Qudamah의 Ameer Al-Matari, Bayt Al-Razqi의 Ali Naji, Saih 공동농가의 별도 로트를 확인했다. 마을과 생산단위는 구분되지만 세 로트 모두 수확연도 미공개여서 반복 시즌 근거는 제한적이다.', [mattari, mattariAli, mattariSaih, mattariMuslotRoast]),
];
