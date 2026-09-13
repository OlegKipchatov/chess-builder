import {Chess} from '../../dist/chess.js';
const fromMoves = moves => {const game=new Chess();moves.split(' ').forEach(move=>game.move(move));return game.fen();};
export const POSITIONS = [
 {id:'opening-simple',fen:new Chess().fen(),purpose:'Начальная позиция: развивающие ходы и недостаток плохих вариантов в top PV.'},
 {id:'opening-complex',fen:fromMoves('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'),purpose:'Сицилианская защита, много разумных планов.'},
 {id:'quiet-middle',fen:fromMoves('d4 d5 Nf3 Nf6 e3 e6 Bd3 Bd6 O-O O-O b3 b6 Bb2 Bb7 Nbd2 Nbd7'),purpose:'Тихая симметричная позиция: плавность выбора равноценных планов.'},
 {id:'tactical-middle',fen:'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 16',purpose:'Кивипит: тактика, шахи, взятия, рокировки.'},
 {id:'several-good',fen:fromMoves('e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 Nc3 d6'),purpose:'Несколько разумных развивающих продолжений.'},
 {id:'only-best',fen:'6k1/5ppp/8/8/8/8/7P/5r1K w - - 0 1',purpose:'Шах: единственный легальный ответ Kg2, проверка forced поведения.'},
 {id:'obvious-tactic',fen:fromMoves('e4 e5 Nf3 Nc6 Bc4 Nd4'),purpose:'Ловушка Блэкберна: внешне привлекательное взятие пешки.'},
 {id:'winning',fen:'8/5pkp/6p1/8/8/8/5PPP/3Q2K1 w - - 0 25',purpose:'Лишний ферзь: преимущество не отключает ошибки.'},
 {id:'losing',fen:'3q2k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 25',purpose:'Без ферзя: без скрытого усиления проигрывающего бота.'},
 {id:'mate-one',fen:'7k/5K2/6Q1/8/8/8/8/8 w - - 0 1',purpose:'Мат в один: управляемая вероятность распознавания.'},
 {id:'mate-two',fen:'k7/8/2K5/8/8/8/2Q5/8 w - - 0 1',purpose:'Ферзь и король против короля: подтверждённый движком мат в два.'},
 {id:'pawn-ending',fen:'8/5k2/4p3/3pPp2/3P1P2/4K3/8/8 w - - 0 40',purpose:'Пешечный эндшпиль, оппозиция и темпы.'},
 {id:'rook-ending',fen:'8/5pk1/6p1/7p/7P/5KP1/r4P2/1R6 w - - 0 40',purpose:'Ладейный эндшпиль: активность, шахи, безопасность пешек.'},
 {id:'black-tactical',fen:fromMoves('f3 e5 g4'),purpose:'Чёрные могут поставить мат; проверка перспективы оценок.'}
];
