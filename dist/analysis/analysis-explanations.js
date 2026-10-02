export const qualityLabel = {best:'Ваш ход',good:'Ваш ход',inaccuracy:'Неточность',mistake:'Ошибка',blunder:'Грубая ошибка'};
export const explanationFor = move => {
 if(move.forced)return 'В этой позиции был только один допустимый ход.';
 if(move.mateTransition==='already_lost')return 'Форсированный мат уже существовал до этого хода. Этот ход не изменил исход.';
 if(move.reason==='allowed_mate')return 'После этого хода соперник получил форсированный мат.';
 if(['missed_mate','mate_opportunity'].includes(move.reason)){
  const opportunity=move.shortMate?.verified?`Можно было поставить мат в ${['','один ход','два хода','три хода','четыре хода'][move.shortMate.moves]}.`:'Было продолжение с форсированным матом.';
  return opportunity+(move.reason==='mate_opportunity'?' Сыгранный ход сохраняет выигрышную позицию.':' Сыгранный ход снизил шансы на победу.');
 }
 if(move.reason==='found_mate')return 'Вы нашли точное продолжение с форсированным матом.';
 if(move.reason==='only_move')return 'Вы нашли точное решение. Другие проверенные продолжения заметно хуже.';
 if(move.recommendationEvidence?.primary)return move.recommendationEvidence.text;
 if(move.reason==='hung_piece')return 'После этого хода соперник может взять вашу фигуру и выиграть материал.';
 if(move.reason==='lost_material')return 'Этот ход позволяет сопернику выиграть материал.';
 if(move.reason==='missed_capture')return 'Здесь можно было выиграть материал взятием.';
 if(move.reason==='missed_tactic')return 'Короткая тактическая последовательность позволяла получить больше материала.';
 if(move.reason==='promotion')return 'Пешка превратилась в новую фигуру с сохранением сильной позиции.';
 if(move.mateTransition==='preserves_mate')return 'Ход сохраняет форсированный мат.';
 if(move.quality==='best')return move.alternatives?.length?'Здесь есть несколько равноценных продолжений.':'';
 if(move.quality==='good')return '';
 if(move.quality==='inaccuracy')return 'Было немного более сильное продолжение.';
 return 'Этот ход заметно ухудшил позицию. Был более сильный вариант.';
};
