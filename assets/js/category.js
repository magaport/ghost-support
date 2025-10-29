const categories = [
    {name: 'ブランドムック', url: '/brandmook/', slugs: []},
    {
        name: '女性ファッション雑誌',
        url: '/women-magazine/',
        slugs: [
            '25ans-hearstfujingaho',
            'androsy-takarajimasha',
            'baila-shueisha',
            'bestory-kobunsha',
            'bijinhyakka-kadokawaharuki',
            'biteki-shogakukan',
            'cancam-shogakukan',
            'domani-shogakukan',
            'eclat-shueisha',
            'elledecor-hearstfujingaho',
            'ellejapon-hearstfujingaho',
            'fudge-saneishobo',
            'fujingaho-hearstfujingaho',
            'gina-bunkasha',
            'ginger-gentosha',
            'glow-takarajimasha',
            'harpersbazaar-hearstfujingaho',
            'inred-takarajimasha',
            'jelly-bunkasha',
            'jj-kobunsha',
            'jsgirl-saneishobo',
            'kimonoanne-tacshuppan',
            'kirapichi-gakken',
            'kunel-magazinehouse',
            'lafarfa-bunkasha',
            'larme-tokumashoten',
            'lee-shueisha',
            'liniere-takarajimasha',
            'loveggg-mediaboy',
            'maquia-shueisha',
            'marisol-shueisha',
            'mini-takarajimasha',
            'more-shueisha',
            'nicola-shinchosha',
            'nicopuchi-shinchosha',
            'nonno-shueisha',
            'numerotokyo-fusosha',
            'oggi-shogakukan',
            'osharetecho-takarajimasha',
            'otonamuse-takarajimasha',
            'popteen-kadokawaharuki',
            'richesse-hearstfujingaho',
            'seventeen-shueisha',
            'spring-takarajimasha',
            'spur-shueisha',
            'steady-takarajimasha',
            'sutekinaanohito-takarajimasha',
            'sweet-takarajimasha',
            'utsukushiikimono-hearstfujingaho',
            'vivi-kodansha',
            'voce-kodansha',
            'waraku-shogakukan',
            'with-kodansha',
            'yogini-peacs'
        ]
    },
    {
        name: '少女・女性マンガの付録',
        url: '/women-manga/',
        slugs: [
            'ciao-shogakukan',
            'nakayosi-kodansha',
            'ribon-shueisha',
            'shocomi-shogakukan'
        ]
    },
    {
        name: '子供・児童学習 雑誌',
        url: '/child-magazine/',
        slugs: [
            'babybook-shogakukan',
            'fukufuku-fukuinkan',
            'genki-kodansha',
            'inaiinai-kodansha',
            'mebae-shogakukan',
            'nene-shufu',
            'okaitsu-kodansha',
            'otomodachi-kodansha',
            'pucchigumi-shogakukan',
            'sho1-shogakukan',
            'sho8-shogakukan',
            'tanoyo-kodansha',
            'telemaga-kodansha',
            'televikun-shogakukan',
            'youchien-shogakukan'
        ]
    },
    {
        name: 'ママ・主婦雑誌',
        url: '/mother-magazine/',
        slugs: [
            '39mag-benesse',
            'akahoshi-shufunotomo',
            'babymo-shufunotomo',
            'cookpadplus-7andi',
            'croissant-magazinehouse',
            'ellegourmet-hearstfujingaho',
            'esse-fusosha',
            'hiyokoclub-benesse',
            'hugmug-sekaibunkasha',
            'kodomoe-hakusensha',
            'lettuceclub-kadokawa',
            'moe-hakusensha',
            'orangepage',
            'premo-shufunotomo',
            'sutekinaokusan-shufutoseikatsusha'
        ]
    },
    {
        name: '結婚情報誌',
        url: '/wedding-magazine/',
        slugs: ['ellemariage-hearstfujingaho', 'zexy-recruit']
    },
    {
        name: 'メンズファッション雑誌',
        url: '/men-magazine/',
        slugs: [
            'dime-shogakukan',
            'getnavi-gakkenplus',
            'lightning-eipublishing',
            'mensclub-hearstfujingaho',
            'mensnonno-shueisha',
            'monomaster-takarajimasha',
            'monomax-takarajimasha',
            'smart-takarajimasha',
            'uomo-shueisha'
        ]
    },
    {
        name: 'アウトドア雑誌',
        url: '/outdoor-magazine/',
        slugs: [
            'bepal-shogakukan',
            'bicycleclub-eipublishing',
            'camplife-yamakei',
            'cyclesports-yaesu',
            'fielder-kasakura',
            'peaks-eipublishing',
            'randonnee-eipublishing',
            'wandervogel-yamakei'
        ]
    },
    {
        name: 'その他雑誌',
        url: '/other-magazine/',
        slugs: [
            'modernliving-hearstfujingaho',
            'nikkeiwoman-nikkeibp',
            'serai-shogakukan',
            'tabinotecho-kotsushinbun',
            'tokyowalker-kadokawa'
        ]
    },
    {
        name: 'エンタメ',
        url: '/entertainment/',
        slugs: [
            'campaign',
            'furoku-favorite',
            'furoku-ranking',
            'furoku-sufficiency',
            'other',
            'recommended',
            'subscription-tokuten'
        ]
    },
    {name: 'Uncategorized', url: '/uncategorized/', slugs: []}
];

async function fetchTags() {
    const apiKey = window.ghostConfig?.contentApiKey;
    if (!apiKey) {
        throw new Error('API key not found');
    }

    const params = new URLSearchParams({
        key: apiKey,
        limit: 'all',
        filter: 'visibility:public',
        order: 'name asc',
        include: 'count.posts'
    });

    const response = await fetch(
        `/ghost/api/content/tags/?${params.toString()}`
    );
    const data = await response.json();

    return data;
}
