// ═══════════════════════════════════════
// SHORTAGES
// Checkbox-grid: every item shown, supervisor sets status by clicking a button.
// No manual add/edit modal. Changes write directly to sts_shortages.
// ══════════════════════════════════════

const SHORTAGE_TABS = {
  bent:      { label:'Bent Parts (SY)', campus:'SY', key:'bent'      },
  bent_rx:   { label:'Bent Parts (RX)', campus:'RX', key:'bent_rx'   },
  lumber_sy: { label:'Lumber (SY)',     campus:'SY', key:'lumber_sy' },
  lumber_rx: { label:'Lumber (RX)',     campus:'RX', key:'lumber_rx' },
};

// ── Master item lists ──
const LUMBER_PROFILES = [
  '.5X1.5A','.5X2.5A','.75X1.5A','.75X2.63A','.75X3A','.75X3.5A','.75X4.5A','.75X5.5A','.75X7.5A','.75X11.5A','.75X24A',
  '1X1.5A','1X2.25A','1X3A','1X5.5A','1.5X1.75A','1.5X2.5A','1.5X3.5A','1.5X5.5A','2X2A','2X4A','3X3A',
  '.5X1.5B','.5X2.5B','.75X1.5B','.75X2.63B','.75X3B','.75X3.5B','.75X4.5B','.75X5.5B','.75X7.5B','.75X11.5B','.75X24B',
  '1X1.5B','1X2.25B','1X3B','1X5.5B','1.5X1.75B','1.5X2.5B','1.5X3.5B','1.5X5.5B','2X2B','2X4B','3X3B',
  '.5X1.5G','.5X2.5G','.75X1.5G','.75X2.63G','.75X3G','.75X3.5G','.75X4.5G','.75X5.5G','.75X7.5G','.75X11.5G','.75X24G',
  '1X1.5G','1X2.25G','1X3G','1X5.5G','1.5X1.75G','1.5X2.5G','1.5X3.5G','1.5X5.5G','2X2G','2X4G','3X3G',
  '.5X1.5GY','.5X2.5GY','.75X1.5GY','.75X2.63GY','.75X3GY','.75X3.5GY','.75X4.5GY','.75X5.5GY','.75X7.5GY','.75X11.5GY','.75X24GY',
  '1X1.5GY','1X2.25GY','1X3GY','1X5.5GY','1.5X1.75GY','1.5X2.5GY','1.5X3.5GY','1.5X5.5GY','2X2GY','2X4GY','3X3GY',
  '.5X1.5LE','.5X2.5LE','.75X1.5LE','.75X2.63LE','.75X3LE','.75X4.5LE','.75X5.5LE','.75X7.5LE','.75X11.5LE','.75X24LE',
  '1X1.5LE','1X2.25LE','1X3LE','1X5.5LE','1.5X1.75LE','1.5X2.5LE','1.5X3.5LE','1.5X5.5LE','2X2LE','2X4LE',
  '.5X1.5LI','.5X2.5LI','.75X1.5LI','.75X2.63LI','.75X3LI','.75X3.5LI','.75X4.5LI','.75X5.5LI','.75X7.5LI','.75X11.5LI','.75X24LI',
  '1X1.5LI','1X2.25LI','1X3LI','1X5.5LI','1.5X1.75LI','1.5X2.5LI','1.5X3.5LI','1.5X5.5LI','2X2LI','2X4LI',
  '.5X1.5LNV','.5X2.5LNV','.75X1.5LNV','.75X2.63LNV','.75X3LNV','.75X3.5LNV','.75X4.5LNV','.75X5.5LNV','.75X7.5LNV','.75X11.5LNV','.75X24LNV',
  '1X1.5LNV','1X2.25LNV','1X3LNV','1X5.5LNV','1.5X1.75LNV','1.5X2.5LNV','1.5X5.5LNV','2X2LNV','2X4LNV',
  '.5X1.5M','.5X2.5M','.75X1.5M','.75X2.63M','.75X3M','.75X3.5M','.75X4.5M','.75X5.5M','.75X7.5M','.75X11.5M','.75X24M',
  '1X1.5M','1X2.25M','1X3M','1X5.5M','1.5X1.75M','1.5X2.5M','1.5X3.5M','1.5X5.5M','2X2M','2X4M','3X3M',
  '.5X1.5-NDW','.5X2.5-NDW','.75X1.5-NDW','.75X2.63-NDW','.75X3-NDW','.75X3.5-NDW','.75X4.5-NDW','.75X5.5-NDW','.75X7.5-NDW','.75X11.5-NDW',
  '1X1.5-NDW','1X2.25-NDW','1X3-NDW','1X5.5-NDW','1.5X1.75-NDW','1.5X2.5-NDW','1.5X3.5-NDW','1.5X5.5-NDW','2X2-NDW','2X4-NDW','3X3-NDW','3.5X3.5-NDW',
  '.5X1.5-NKA','.5X2.5-NKA','.75X1.5-NKA','.75X2.63-NKA','.75X3-NKA','.75X3.5-NKA','.75X4.5-NKA','.75X5.5-NKA','.75X7.5-NKA','.75X11.5-NKA',
  '1X1.5-NKA','1X2.25-NKA','1X3-NKA','1X5.5-NKA','1.5X1.75-NKA','1.5X2.5-NKA','1.5X3.5-NKA','1.5X5.5-NKA','2X2-NKA','2X4-NKA','3X3-NKA','3.5X3.5-NKA',
  '.5X1.5-NTL','.5X2.5-NTL','.75X1.5-NTL','.75X2.63-NTL','.75X3-NTL','.75X3.5-NTL','.75X4.5-NTL','.75X5.5-NTL','.75X7.5-NTL','.75X11.5-NTL',
  '1X1.5-NTL','1X2.25-NTL','1X3-NTL','1X5.5-NTL','1.5X1.75-NTL','1.5X2.5-NTL','1.5X3.5-NTL','1.5X5.5-NTL','2X2-NTL','2X4-NTL','3X3-NTL','3.5X3.5-NTL',
  '.5X1.5PB','.5X2.5PB','.75X1.5PB','.75X2.63PB','.75X3PB','.75X3.5PB','.75X4.5PB','.75X5.5PB','.75X7.5PB','.75X11.5PB','.75X24PB',
  '1X1.5PB','1X2.25PB','1X3PB','1X5.5PB','1.5X1.75PB','1.5X2.5PB','1.5X3.5PB','1.5X5.5PB','2X2PB','2X4PB',
  '.5X1.5S','.5X2.5S','.75X1.5S','.75X2.63S','.75X3S','.75X3.5S','.75X4.5S','.75X5.5S','.75X7.5S','.75X11.5S','.75X24S',
  '1X1.5S','1X2.25S','1X3S','1X5.5S','1.5X1.75S','1.5X2.5S','1.5X3.5S','1.5X5.5S','2X2S','2X4S','3X3S',
  '.5X1.5SR','.5X2.5SR','.75X1.5SR','.75X2.63SR','.75X3SR','.75X3.5SR','.75X4.5SR','.75X5.5SR','.75X7.5SR','.75X11.5SR','.75X24SR',
  '1X1.5SR','1X2.25SR','1X3SR','1X5.5SR','1.5X1.75SR','1.5X2.5SR','1.5X3.5SR','1.5X5.5SR','2X2SR','2X4SR',
  '.5X1.5T','.5X2.5T','.75X1.5T','.75X2.63T','.75X3T','.75X3.5T','.75X4.5T','.75X5.5T','.75X7.5T','.75X11.5T','.75X24T',
  '1X1.5T','1X2.25T','1X3T','1X5.5T','1.5X1.75T','1.5X2.5T','1.5X3.5T','1.5X5.5T','2X2T','2X4T','3X3T',
  '.5X1.5TA','.5X2.5TA','.75X1.5TA','.75X2.63TA','.75X3TA','.75X3.5TA','.75X4.5TA','.75X5.5TA','.75X7.5TA','.75X11.5TA','.75X24TA',
  '1X1.5TA','1X2.25TA','1X3TA','1X5.5TA','1.5X1.75TA','1.5X5.5TA',
  '.5X1.5VCF','.5X2.5VCF','.75X1.5VCF','.75X2.63VCF','.75X3VCF','.75X3.5VCF','.75X4.5VCF','.75X5.5VCF','.75X7.5VCF','.75X11.5VCF',
  '1X1.5VCF','1X2.25VCF','1X3VCF','1X5.5VCF','1.5X1.75VCF','1.5X2.5VCF','1.5X3.5VCF','1.5X5.5VCF','2X2VCF','2X4VCF','3X3VCF','3.5X3.5VCF',
  '.5X1.5VSH','.5X2.5VSH','.75X1.5VSH','.75X2.63VSH','.75X3VSH','.75X3.5VSH','.75X4.5VSH','.75X5.5VSH','.75X7.5VSH','.75X11.5VSH',
  '1X1.5VSH','1X2.25VSH','1X3VSH','1X5.5VSH','1.5X1.75VSH','1.5X2.5VSH','1.5X3.5VSH','1.5X5.5VSH','2X2VSH','2X4VSH','3X3VSH','3.5X3.5VSH',
  '.5X1.5VWH','.5X2.5VWH','.75X1.5VWH','.75X2.63VWH','.75X3VWH','.75X3.5VWH','.75X4.5VWH','.75X5.5VWH','.75X7.5VWH','.75X11.5VWH',
  '1X1.5VWH','1X3VWH','1X5.5VWH','1.5X1.75VWH','1.5X2.5VWH','1.5X3.5VWH','1.5X5.5VWH','2X2VWH','2X4VWH','3X3VWH','3.5X3.5VWH',
  '.5X1.5W','.5X2.5W','.75X1.5W','.75X2.63W','.75X3W','.75X3.5W','.75X4.5W','.75X5.5W','.75X7.5W','.75X11.5W','.75X24W',
  '1X1.5W','1X2.25W','1X3W','1X5.5W','1.5X1.75W','1.5X2.5W','1.5X3.5W','1.5X5.5W','2X2W','2X4W','3X3W',
];

const BENT_PART_NUMBERS = [
  'PRJ471BL','PRJ471WH','PRJ471GY','PRJ471GR','PRJ471TE','PRJ471MA','PRJ471SA',
  'PRCBAD1BL','PRCBAD1WH','PRCBAD1GY','PRCBAD1GR','PRCBAD1TE','PRCBAD1MA','PRCBAD1SA','PRCBAD1PB','PRCBAD1SR','PRCBAD1AR','PRCBAD1TA','PRCBAD1LE','PRCBAD1LI','PRCBAD1NV','PRCBAD1CR',
  'PRCBAD2BL','PRCBAD2WH','PRCBAD2GY','PRCBAD2GR','PRCBAD2TE','PRCBAD2MA','PRCBAD2SA','PRCBAD2PB','PRCBAD2SR','PRCBAD2AR','PRCBAD2TA','PRCBAD2LE','PRCBAD2LI','PRCBAD2NV','PRCBAD2CR',
  'PRCBAD3BL','PRCBAD3WH','PRCBAD3GY','PRCBAD3GR','PRCBAD3TE','PRCBAD3MA','PRCBAD3SA','PRCBAD3PB','PRCBAD3SR','PRCBAD3AR','PRCBAD3TA','PRCBAD3LE','PRCBAD3LI','PRCBAD3NV','PRCBAD3CR',
  'PRHLD2001BL','PRHLD2001WH','PRHLD2001GY','PRHLD2001GR','PRHLD2001TE','PRHLD2001MA','PRHLD2001SA','PRHLD2001PB','PRHLD2001SR','PRHLD2001AR','PRHLD2001TA','PRHLD2001LE','PRHLD2001LI','PRHLD2001NV',
  'PRHLD2002BL','PRHLD2002WH','PRHLD2002GY','PRHLD2002GR','PRHLD2002TE','PRHLD2002MA','PRHLD2002SA','PRHLD2002PB','PRHLD2002SR','PRHLD2002AR','PRHLD2002TA','PRHLD2002LE','PRHLD2002LI','PRHLD2002NV',
  'PRTXC231BL','PRTXC231WH','PRTXC231GY','PRTXC231GR','PRTXC231TE','PRTXC231MA','PRTXC231SA',
  'PRTD2001BL','PRTD2001WH','PRTD2001GY','PRTD2001GR','PRTD2001TE','PRTD2001MA','PRTD2001SA','PRTD2001PB','PRTD2001SR','PRTD2001AR','PRTD2001TA','PRTD2001LE','PRTD2001LI','PRTD2001NV',
  'PRTD2002BL','PRTD2002WH','PRTD2002GY','PRTD2002GR','PRTD2002TE','PRTD2002MA','PRTD2002SA','PRTD2002PB','PRTD2002SR','PRTD2002AR','PRTD2002TA','PRTD2002LE','PRTD2002LI','PRTD2002NV',
  'PRIVW22801BL','PRIVW22801WH','PRIVW22801GY','PRIVW22801GR','PRIVW22801TE','PRIVW22801MA','PRIVW22801SA','PRIVW22801PB','PRIVW22801SR','PRIVW22801AR','PRIVW22801TA','PRIVW22801LE','PRIVW22801LI','PRIVW22801NV',
  'PRIVW22802BL','PRIVW22802WH','PRIVW22802GY','PRIVW22802GR','PRIVW22802TE','PRIVW22802MA','PRIVW22802SA','PRIVW22802PB','PRIVW22802SR','PRIVW22802AR','PRIVW22802TA','PRIVW22802LE','PRIVW22802LI','PRIVW22802NV',
  'PRTXC22801BL','PRTXC22801WH','PRTXC22801GY','PRTXC22801GR','PRTXC22801TE','PRTXC22801MA','PRTXC22801SA','PRTXC22801PB','PRTXC22801SR','PRTXC22801AR','PRTXC22801TA','PRTXC22801LE','PRTXC22801LI','PRTXC22801NV',
  'PRTXC22802BL','PRTXC22802WH','PRTXC22802GY','PRTXC22802GR','PRTXC22802TE','PRTXC22802MA','PRTXC22802SA','PRTXC22802PB','PRTXC22802SR','PRTXC22802AR','PRTXC22802TA','PRTXC22802LE','PRTXC22802LI','PRTXC22802NV',
  'PRTXD381BL','PRTXD381WH','PRTXD381GY','PRTXD381GR','PRTXD381TE','PRTXD381MA','PRTXD381SA','PRTXD381PB','PRTXD381SR','PRTXD381AR','PRTXD381TA','PRTXD381LE','PRTXD381LI','PRTXD381NV',
  'PRTXD382BL','PRTXD382WH','PRTXD382GY','PRTXD382GR','PRTXD382TE','PRTXD382MA','PRTXD382SA','PRTXD382PB','PRTXD382SR','PRTXD382AR','PRTXD382TA','PRTXD382LE','PRTXD382LI','PRTXD382NV',
  'PR90001BL','PR90001WH','PR90001GY','PR90001GR','PR90001TE','PR90001MA','PR90001SA','PR90001PB','PR90001SR','PR90001AR','PR90001TA','PR90001LE','PR90001LI','PR90001NV',
  'PR90002BL','PR90002WH','PR90002GY','PR90002GR','PR90002TE','PR90002MA','PR90002SA','PR90002PB','PR90002SR','PR90002AR','PR90002TA','PR90002LE','PR90002LI','PR90002NV',
  'PRADD2001BL','PRADD2001WH','PRADD2001GY','PRADD2001GR','PRADD2001TE','PRADD2001MA','PRADD2001SA','PRADD2001PB','PRADD2001SR','PRADD2001AR','PRADD2001TA','PRADD2001LE','PRADD2001LI','PRADD2001NV',
  'PRADD2002BL','PRADD2002WH','PRADD2002GY','PRADD2002GR','PRADD2002TE','PRADD2002MA','PRADD2002SA','PRADD2002PB','PRADD2002SR','PRADD2002AR','PRADD2002TA','PRADD2002LE','PRADD2002LI','PRADD2002NV',
  'PRADD2003BL','PRADD2003WH','PRADD2003GY','PRADD2003GR','PRADD2003TE','PRADD2003MA','PRADD2003SA','PRADD2003PB','PRADD2003SR','PRADD2003AR','PRADD2003TA','PRADD2003LE','PRADD2003LI','PRADD2003NV',
  'PRADD2006BL','PRADD2006WH','PRADD2006GY','PRADD2006GR','PRADD2006TE','PRADD2006MA','PRADD2006SA','PRADD2006PB','PRADD2006SR','PRADD2006AR','PRADD2006TA','PRADD2006LE','PRADD2006LI','PRADD2006NV',
  'PR19101BL','PR19101WH','PR19101GY','PR19101GR','PR19101TE','PR19101MA','PR19101SA','PR19101VWH','PR19101VCF','PR19101VSH',
  'PR19102BL','PR19102WH','PR19102GY','PR19102GR','PR19102TE','PR19102MA','PR19102SA','PR19102VWH','PR19102VCF','PR19102VSH',
  'PRLND2004BL','PRLND2004WH','PRLND2004GY','PRLND2004GR','PRLND2004TE','PRLND2004MA','PRLND2004SA','PRLND2004PB','PRLND2004SR','PRLND2004AR','PRLND2004TA','PRLND2004LE','PRLND2004LI','PRLND2004NV',
  'PRLND2006BL','PRLND2006WH','PRLND2006GY','PRLND2006GR','PRLND2006TE','PRLND2006MA','PRLND2006SA','PRLND2006PB','PRLND2006SR','PRLND2006AR','PRLND2006TA','PRLND2006LE','PRLND2006LI','PRLND2006NV',
  'PRMVAD4701AR','PRMVAD4701LI','PRMVAD4701WH','PRMVAD4701GR','PRMVAD4701PB','PRMVAD4701TA','PRMVAD4701LE',
  'PRMVAD4702AR','PRMVAD4702LI','PRMVAD4702WH','PRMVAD4702GR','PRMVAD4702PB','PRMVAD4702TA','PRMVAD4702LE',
  'PREMD1001BL','PREMD1001WH','PREMD1001GY','PREMD1001GR','PREMD1001TE','PREMD1001MA','PREMD1001SA','PREMD1001VWH','PREMD1001VCF','PREMD1001VSH',
  'PREMD1901BL','PREMD1901WH','PREMD1901GY','PREMD1901GR','PREMD1901TE','PREMD1901MA','PREMD1901SA','PREMD1901VWH','PREMD1901VCF','PREMD1901VSH',
  'PRTD1001BL','PRTD1001WH','PRTD1001GY','PRTD1001GR','PRTD1001TE','PRTD1001MA','PRTD1001SA','PRTD1001PB','PRTD1001SR','PRTD1001AR','PRTD1001TA','PRTD1001LE','PRTD1001LI','PRTD1001NV','PRTD1001VWH','PRTD1001VCF','PRTD1001VSH',
  'PRTD1002BL','PRTD1002WH','PRTD1002GY','PRTD1002GR','PRTD1002TE','PRTD1002MA','PRTD1002SA','PRTD1002PB','PRTD1002SR','PRTD1002AR','PRTD1002TA','PRTD1002LE','PRTD1002LI','PRTD1002NV',
  'PRTD1003BL','PRTD1003WH','PRTD1003GY','PRTD1003GR','PRTD1003TE','PRTD1003MA','PRTD1003SA','PRTD1003PB','PRTD1003SR','PRTD1003AR','PRTD1003TA','PRTD1003LE','PRTD1003LI','PRTD1003NV',
  'PRTD1004BL','PRTD1004WH','PRTD1004GY','PRTD1004GR','PRTD1004TE','PRTD1004MA','PRTD1004SA','PRTD1004PB','PRTD1004SR','PRTD1004AR','PRTD1004TA','PRTD1004LE','PRTD1004LI','PRTD1004NV',
  'PRTD1021BL','PRTD1021WH','PRTD1021GY','PRTD1021GR','PRTD1021TE','PRTD1021MA','PRTD1021SA','PRTD1021PB','PRTD1021SR','PRTD1021AR','PRTD1021TA','PRTD1021LE','PRTD1021LI','PRTD1021NV','PRTD1021VWH','PRTD1021VCF','PRTD1021VSH',
  'PRTD1102BL','PRTD1102WH','PRTD1102GY','PRTD1102MA','PRTD1102SA',
  'PRTD1103BL','PRTD1103WH','PRTD1103GY','PRTD1103MA','PRTD1103SA',
  'PRTD1104BL','PRTD1104WH','PRTD1104GY','PRTD1104MA','PRTD1104SA',
  'PRR1001BL','PRR1001WH','PRR1001GY','PRR1001GR','PRR1001TE','PRR1001MA','PRR1001SA','PRR1001VWH','PRR1001VCF','PRR1001VSH',
  'PRTGD1301BL','PRTGD1301WH','PRTGD1301GY','PRTGD1301GR','PRTGD1301TE','PRTGD1301MA','PRTGD1301SA','PRTGD1301VWH','PRTGD1301VCF','PRTGD1301VSH',
  'PRTGD1321BL','PRTGD1321WH','PRTGD1321GY','PRTGD1321GR','PRTGD1321TE','PRTGD1321MA','PRTGD1321SA','PRTGD1321VWH','PRTGD1321VCF','PRTGD1321VSH',
  'PRCDCW22781BL','PRCDCW22781WH','PRCDCW22781GY','PRCDCW22781GR','PRCDCW22781TE','PRCDCW22781MA','PRCDCW22781SA',
  'PRWCW22781BL','PRWCW22781WH','PRWCW22781GY','PRWCW22781GR','PRWCW22781TE','PRWCW22781MA','PRWCW22781SA',
  'PRCDSB37751BL','PRCDSB37751WH','PRCDSB37751GY','PRCDSB37751GR','PRCDSB37751TE','PRCDSB37751MA','PRCDSB37751SA',
  'PRWSB37751BL','PRWSB37751WH','PRWSB37751GY','PRWSB37751GR','PRWSB37751TE','PRWSB37751MA','PRWSB37751SA',
  'PR47111BL','PR47111WH','PR47111GY','PR47111GR','PR47111TE','PR47111MA','PR47111SA',
  'PR47211BL','PR47211WH','PR47211GY','PR47211GR','PR47211TE','PR47211MA','PR47211SA',
  'PR47311BL','PR47311WH','PR47311GY','PR47311GR','PR47311TE','PR47311MA','PR47311SA',
  'PRBC23001BL','PRBC23001WH','PRBC23001GY','PRBC23001GR','PRBC23001TE','PRBC23001MA','PRBC23001SA',
  'PRBC23021BL','PRBC23021WH','PRBC23021GY','PRBC23021GR','PRBC23021TE','PRBC23021MA','PRBC23021SA',
  'PRBC23031BL','PRBC23031WH','PRBC23031GY','PRBC23031GR','PRBC23031TE','PRBC23031MA','PRBC23031SA',
  'PRC22801BL','PRC22801WH','PRC22801GY','PRC22801GR','PRC22801TE','PRC22801MA','PRC22801SA',
  'PRCDB241BL','PRCDB241WH','PRCDB241GY','PRCDB241GR','PRCDB241TE','PRCDB241MA','PRCDB241SA',
  'PRCDB2431BL','PRCDB2431WH','PRCDB2431GY','PRCDB2431GR','PRCDB2431TE','PRCDB2431MA','PRCDB2431SA',
  'PRCDB601BL','PRCDB601WH','PRCDB601GY','PRCDB601GR','PRCDB601TE','PRCDB601MA','PRCDB601SA',
  'PRCDB6031BL','PRCDB6031WH','PRCDB6031GY','PRCDB6031GR','PRCDB6031TE','PRCDB6031MA','PRCDB6031SA',
  'PRCDD1001BL','PRCDD1001WH','PRCDD1001GY','PRCDD1001GR','PRCDD1001TE','PRCDD1001MA','PRCDD1001SA',
  'PRCDD2301BL','PRCDD2301WH','PRCDD2301GY','PRCDD2301GR','PRCDD2301TE','PRCDD2301MA','PRCDD2301SA',
  'PRCT4P2311BL','PRCT4P2311WH','PRCT4P2311GY','PRCT4P2311GR','PRCT4P2311TE','PRCT4P2311MA','PRCT4P2311SA',
  'PRRK1951BL','PRRK1951WH','PRRK1951GY','PRRK1951GR','PRRK1951TE','PRRK1951MA','PRRK1951SA',
  'PRTGB4811BL','PRTGB4811WH','PRTGB4811GY','PRTGB4811GR','PRTGB4811TE','PRTGB4811MA','PRTGB4811SA',
  'PRTGB6011BL','PRTGB6011WH','PRTGB6011GY','PRTGB6011GR','PRTGB6011TE','PRTGB6011MA','PRTGB6011SA',
  'PRTGD2901BL','PRTGD2901WH','PRTGD2901GY','PRTGD2901GR','PRTGD2901TE','PRTGD2901MA','PRTGD2901SA',
  'PRIVTD1102BL','PRIVTD1102WH','PRIVTD1102GY','PRIVTD1102MA','PRIVTD1102SA',
  'PR688WF11BL','PR688WF11WH','PR688WF11MA','PR688WF11PB','PR688WF11SR','PR688WF11NV',
  'PRTCSCAPE1WH','PRTCSCAPE1GY','PRTCSCAPE1SA','PRTCSCAPE2WH','PRTCSCAPE2GY','PRTCSCAPE2SA',
  'PR11201BL','PR11201WH','PR11201GY','PR11201GR','PR11201TE','PR11201MA','PR11201SA',
  'PR11202BL','PR11202WH','PR11202GY','PR11202GR','PR11202TE','PR11202MA','PR11202SA',
  'PR22021BL','PR22021WH','PR22021GY','PR22021TE',
  'PRNB1BL','PRNB1WH','PRNB1GY','PRNB1GR','PRNB1TE','PRNB1MA','PRNB1SA','PRNB1VWH','PRNB1VCF','PRNB1VSH',
  'PRLLSC1BL','PRLLSC1WH','PRLLSC1GY','PRLLSC1GR','PRLLSC1MA','PRLLSC1SA',
  'PR421D1001VWH','PR421D1001VCF','PR421D1001VSH',
  'PR423D1001VWH','PR423D1001VCF','PR423D1001VSH',
  'PR423D1002VWH','PR423D1002VCF','PR423D1002VSH',
  'P10005BL','P10005WH',
  'PRA1002BL','PRA1002WH','PRA1002GY','PRA1002GR','PRA1002TE','PRA1002MA','PRA1002SA','PRA1002PB','PRA1002SR','PRA1002AR','PRA1002TA','PRA1002LE','PRA1002LI','PRA1002NV',
];

// ── Runtime state ──
let shortageCache = { bent:[], bent_rx:[], lumber_sy:[], lumber_rx:[] };
let shortageSearchQuery = sessionStorage.getItem('sts_shortage_search') || '';
let pendingShortageApprovalContext = null;

const savedShortageTab = sessionStorage.getItem('sts_active_shortage_tab');
if (savedShortageTab && SHORTAGE_TABS[savedShortageTab]) activeShortageTab = savedShortageTab;

// ══════════════════════════════════════
// LOAD
// ══════════════════════════════════════
async function loadShortages(silent = false) {
  try {
    const rows = await sb('sts_shortages?order=sku.asc&select=*');
    shortageCache = { bent:[], bent_rx:[], lumber_sy:[], lumber_rx:[] };
    (rows || []).forEach(r => { if (shortageCache[r.category]) shortageCache[r.category].push(r); });
  } catch(e) {
    console.warn('sts_shortages not found:', e.message);
    shortageCache = { bent:[], bent_rx:[], lumber_sy:[], lumber_rx:[] };
  }
  if (!silent) renderShortageTab();
}

// ══════════════════════════════════════
// HELPERS (used by schedule.js / bom.js)
// ══════════════════════════════════════
function _allRows() { return Object.values(shortageCache).flat(); }

function getOutOfStockSkus() {
  const campus = currentUser?.campus || 'SY';
  const s = new Set();
  _allRows().forEach(r => {
    if (r.campus === campus && r.status === 'out_of_stock' && !approvedOverrides[r.sku])
      s.add(r.sku.toUpperCase());
  });
  return s;
}

function getLowQtySkus() {
  const campus = currentUser?.campus || 'SY';
  const s = new Set();
  _allRows().forEach(r => {
    if (r.campus === campus && r.status === 'low_quantity' && !approvedOverrides[r.sku])
      s.add(r.sku.toUpperCase());
  });
  return s;
}

function isSKUBlocked(sku)  { return getOutOfStockSkus().has(String(sku || '').toUpperCase()); }
function isSKUGreyList(sku) { return getLowQtySkus().has(String(sku || '').toUpperCase()); }

// ══════════════════════════════════════
// RENDER — status-button grid
// ══════════════════════════════════════
function switchShortageTab(tab) {
  activeShortageTab = tab;
  sessionStorage.setItem('sts_active_shortage_tab', tab);
  document.querySelectorAll('.sh-tab').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('stab-' + tab);
  if (el) el.classList.add('active');
  renderShortageTab();
}

function renderShortageTab() {
  const content = document.getElementById('shortage-content');
  if (!content) return;

  const tabCfg = SHORTAGE_TABS[activeShortageTab];
  if (!tabCfg) return;

  const shEsc = typeof esc === 'function'
    ? esc
    : v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const isSup  = SUP_ROLES.includes(currentUser?.role);
  const campus = tabCfg.campus;
  const dbMap  = {};
  (shortageCache[tabCfg.key] || []).forEach(r => { dbMap[String(r.sku || '').toUpperCase()] = r; });

  const keyEl = document.getElementById('sh-lumber-key');
  if (keyEl) keyEl.style.display = (tabCfg.key === 'bent' || tabCfg.key === 'bent_rx') ? 'none' : 'block';

  document.querySelectorAll('.sh-tab').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById('stab-' + activeShortageTab);
  if (tabEl) tabEl.classList.add('active');

  const isBent = tabCfg.key === 'bent' || tabCfg.key === 'bent_rx';
  const masterList = isBent ? BENT_PART_NUMBERS : LUMBER_PROFILES;
  const q = String(shortageSearchQuery || '').trim().toUpperCase();
  const filteredList = q
    ? masterList.filter(sku => {
        const key = String(sku || '').toUpperCase();
        const row = dbMap[key];
        return key.includes(q)
          || String(row?.notes || '').toUpperCase().includes(q)
          || String(row?.status || '').toUpperCase().includes(q);
      })
    : masterList;

  const outCount = masterList.filter(s => dbMap[String(s).toUpperCase()]?.status === 'out_of_stock').length;
  const lowCount = masterList.filter(s => dbMap[String(s).toUpperCase()]?.status === 'low_quantity').length;

  let html = `<div style="display:flex;gap:12px;align-items:center;padding:10px 0 8px;flex-wrap:wrap;">
    <span style="font-size:12px;color:var(--text-muted);">${filteredList.length} shown of ${masterList.length} items</span>
    ${outCount ? `<span class="badge b-ship">${outCount} Out of Stock</span>` : '<span style="font-size:12px;color:var(--green);">No blocked items</span>'}
    ${lowCount ? `<span class="badge b-greylist">${lowCount} Low Stock</span>` : ''}
    ${!isSup ? '<span style="font-size:11px;color:var(--text-muted);">View only</span>' : ''}
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px;">
    <input class="input sh-filter" id="shortage-search-input" value="${shEsc(shortageSearchQuery)}" placeholder="Search SKU / profile / notes..." style="max-width:260px;font-size:13px;" oninput="setShortageSearch(this.value)">
    ${shortageSearchQuery ? `<button class="btn btn-ghost btn-xs" onclick="clearShortageSearch()">Clear Search</button>` : ''}
    <button class="btn btn-ghost btn-sm" id="sh-instock-toggle-btn" onclick="toggleShInStock(this)">Hide In-Stock Rows</button>
  </div>`;

  if (tabCfg.key !== 'bent') {
    html += `<div style="font-size:11px;color:var(--text-muted);line-height:1.8;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:10px;">
      <strong style="color:var(--text);">Color Key:</strong>
      A=AR &middot; B=BL/CB &middot; G=GR/RC &middot; GY=GY/SS &middot; LE=LE &middot; LI=LI &middot; LNV=LNV/NV &middot; M=MA/VL &middot; NDW=NDW &middot; NKA=NKA &middot; NTL=NTL &middot; PB=PB &middot; S=SA/SC &middot; SR=SR &middot; T=TE/TH &middot; TA=TA &middot; VCF=VCF &middot; VSH=VSH &middot; VWH=VWH &middot; W=WH/CW
    </div>`;
  }

  html += `<div class="sh-grid-wrap"><table class="sh-table sh-grid"><thead><tr>
    <th>SKU / Profile</th>
    <th style="text-align:center;color:var(--green);width:90px;">In Stock</th>
    <th style="text-align:center;color:var(--yellow);width:90px;">Low Stock</th>
    <th style="text-align:center;color:var(--red);width:100px;">Out of Stock</th>
    <th style="min-width:160px;">Notes</th>
  </tr></thead><tbody>`;

  if (!filteredList.length) {
    html += `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:24px;">No shortage items match <strong>${shEsc(shortageSearchQuery)}</strong>.</td></tr>`;
  }

  filteredList.forEach(sku => {
    const key    = String(sku || '').toUpperCase();
    const row    = dbMap[key];
    const status = row?.status || 'in_stock';
    const notes  = row?.notes  || '';
    const rowId  = row?.id     || null;
    const rIn = status === 'in_stock', rLow = status === 'low_quantity', rOut = status === 'out_of_stock';
    const rowStyle = rOut ? ' style="background:rgba(255,60,60,.07);"' : rLow ? ' style="background:rgba(255,200,0,.06);"' : '';

    const rowCls = rIn ? ' class="sh-row-instock"' : '';

    if (!isSup) {
      const badge = rOut ? '<span class="badge b-ship" style="font-size:10px;">Out of Stock</span>'
                  : rLow ? '<span class="badge b-greylist" style="font-size:10px;">Low Stock</span>'
                  : '<span style="font-size:11px;color:var(--green);">In Stock</span>';
      html += `<tr${rowStyle}${rowCls}><td style="font-family:var(--mono);font-size:12px;font-weight:600;">${shEsc(sku)}</td><td colspan="3" style="text-align:center;">${badge}</td><td style="font-size:11px;color:var(--text-muted);">${shEsc(notes)}</td></tr>`;
    } else {
      const sid = rowId ? shEsc(String(rowId)) : 'null';
      const sk  = shEsc(key);
      const cat = tabCfg.key;
      html += `<tr${rowStyle}${rowCls}>
        <td style="font-family:var(--mono);font-size:12px;font-weight:600;">${shEsc(sku)}</td>
        <td style="text-align:center;"><button class="sh-status-btn sh-in${rIn ? ' active' : ''}" onclick="setShortageStatus('${sk}','in_stock','${cat}','${campus}','${sid}',this)">In Stock</button></td>
        <td style="text-align:center;"><button class="sh-status-btn sh-low${rLow ? ' active' : ''}" onclick="setShortageStatus('${sk}','low_quantity','${cat}','${campus}','${sid}',this)">Low</button></td>
        <td style="text-align:center;"><button class="sh-status-btn sh-out${rOut ? ' active' : ''}" onclick="setShortageStatus('${sk}','out_of_stock','${cat}','${campus}','${sid}',this)">Out</button></td>
        <td><input type="text" class="sh-notes-input" placeholder="Notes..." value="${shEsc(notes)}" onchange="saveShortageNotes('${sk}','${cat}','${campus}','${sid}',this.value)"></td>
      </tr>`;
    }
  });

  html += '</tbody></table></div>';
  content.innerHTML = html;

  const input = document.getElementById('shortage-search-input');
  if (input) {
    const len = input.value.length;
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(len, len); } catch(e) {}
  }
}

function toggleShInStock(btn) {
  const hiding = btn.textContent.trim().startsWith('Hide');
  document.querySelectorAll('.sh-table tr.sh-row-instock').forEach(tr => {
    tr.style.display = hiding ? 'none' : '';
  });
  btn.textContent = hiding ? 'Show In-Stock Rows' : 'Hide In-Stock Rows';
}

function setShortageSearch(value) {
  shortageSearchQuery = value || '';
  sessionStorage.setItem('sts_shortage_search', shortageSearchQuery);
  renderShortageTab();
}

function clearShortageSearch() {
  shortageSearchQuery = '';
  sessionStorage.removeItem('sts_shortage_search');
  renderShortageTab();
}

// ══════════════════════════════════════
// STATUS UPDATE
// ══════════════════════════════════════
async function setShortageStatus(sku, newStatus, category, campus, rowId, btn) {
  if (!SUP_ROLES.includes(currentUser?.role)) return;
  const tr = btn.closest('tr');
  tr.querySelectorAll('.sh-status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  tr.style.background = newStatus === 'out_of_stock' ? 'rgba(255,60,60,.07)' : newStatus === 'low_quantity' ? 'rgba(255,200,0,.06)' : '';

  const notes   = tr.querySelector('.sh-notes-input')?.value || '';
  const payload = { sku, category, status: newStatus, notes, campus, created_by: currentUser.name, updated_at: new Date().toISOString() };

  try {
    if (rowId && rowId !== 'null') {
      if (newStatus === 'in_stock') {
        await sb('sts_shortages?id=eq.' + rowId, 'DELETE');
        tr.querySelectorAll('[onclick],[onchange]').forEach(el => {
          ['onclick','onchange'].forEach(ev => {
            const v = el.getAttribute(ev);
            if (v) el.setAttribute(ev, v.replace(new RegExp("'" + rowId + "'", 'g'), "'null'"));
          });
        });
      } else {
        await sb('sts_shortages?id=eq.' + rowId, 'PATCH', payload, { prefer:'return=minimal' });
      }
    } else if (newStatus !== 'in_stock') {
      const [created] = await sb('sts_shortages', 'POST', [payload]);
      if (created?.id) {
        tr.querySelectorAll('[onclick],[onchange]').forEach(el => {
          ['onclick','onchange'].forEach(ev => {
            const v = el.getAttribute(ev);
            if (v) el.setAttribute(ev, v.replace(/'null'/g, "'" + created.id + "'"));
          });
        });
      }
    }
    await loadShortages(true);
    if (scheduleItems.length) render();
    toast(newStatus === 'in_stock' ? 'Marked in stock' : newStatus === 'low_quantity' ? 'Marked low stock' : 'Marked out of stock', 'ok');
  } catch(e) { toast('Update failed: ' + e.message, 'err'); renderShortageTab(); }
}

async function saveShortageNotes(sku, category, campus, rowId, notes) {
  if (!SUP_ROLES.includes(currentUser?.role) || !rowId || rowId === 'null') return;
  try {
    await sb('sts_shortages?id=eq.' + rowId, 'PATCH', { notes, updated_at: new Date().toISOString() }, { prefer:'return=minimal' });
    await loadShortages(true);
  } catch(e) { toast('Notes save failed: ' + e.message, 'err'); }
}

// ══════════════════════════════════════
// APPROVE OVERRIDE (used from schedule cards)
// ══════════════════════════════════════
function openShortageApprove(finishedSku, notes = '', materialSku = '', componentSku = '', status = '') {
  const affectedSku = String(finishedSku || '').trim().toUpperCase();
  const material    = String(materialSku || componentSku || finishedSku || '').trim().toUpperCase();
  const component   = String(componentSku || '').trim().toUpperCase();
  const stat        = String(status || '').trim() || (isSKUGreyList(material) ? 'low_quantity' : isSKUBlocked(material) ? 'out_of_stock' : 'low_quantity');

  pendingShortageApproval = material || affectedSku;
  pendingShortageApprovalContext = { finishedSku: affectedSku, materialSku: material, componentSku: component, status: stat, notes };

  const statusLabel = stat === 'out_of_stock' ? 'OUT OF STOCK' : stat === 'low_quantity' ? 'LOW QUANTITY' : stat.toUpperCase();
  const parts = [];
  if (affectedSku && affectedSku !== material) parts.push(`${affectedSku} is affected by material/profile ${material}.`);
  else parts.push(`${material || affectedSku} is ${statusLabel}.`);
  if (component && component !== material) parts.push(`BOM component: ${component}.`);
  parts.push(`Status: ${statusLabel}.`);
  if (notes) parts.push(`Notes: ${notes}`);

  document.getElementById('sh-approve-sub').textContent = parts.join(' ');
  document.getElementById('sh-approve-reason').value = '';
  document.getElementById('modal-sh-approve').classList.add('open');
}

function confirmShortageApprove() {
  const reason = document.getElementById('sh-approve-reason').value.trim();
  if (!reason) { toast('Please enter a reason', 'err'); return; }

  const key = pendingShortageApproval;
  if (!key) { toast('No shortage selected for approval', 'err'); return; }

  approvedOverrides[key] = reason;
  if (pendingShortageApprovalContext?.finishedSku) approvedOverrides[pendingShortageApprovalContext.finishedSku] = reason;

  const label = pendingShortageApprovalContext?.materialSku || key;
  toast('Override approved for ' + label, 'ok');

  pendingShortageApproval = null;
  pendingShortageApprovalContext = null;
  closeModal('modal-sh-approve');
  renderShortageTab();
  if (scheduleItems.length) render();
}