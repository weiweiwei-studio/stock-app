export function malaysiaDate(value = new Date()) {
    const date = value?.seconds !== undefined ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = type => parts.find(entry => entry.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

export function initialProductionFields(status, date, now = new Date()) {
    if (!['To Make', 'Making'].includes(status)) throw new Error('請選擇有效的初始狀態。');
    if (!date) {
        if (status === 'Making') throw new Error('製作中工單必須填寫開始製作日。');
        return { status, makingAt: null };
    }
    const makingAt = new Date(`${date}T00:00:00+08:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || malaysiaDate(makingAt) !== date) {
        throw new Error('請填寫有效的開始製作日。');
    }
    if (status === 'Making' && date > malaysiaDate(now)) {
        throw new Error('製作中工單的開始製作日不可晚於今天；未來排程請選待製作。');
    }
    return { status, makingAt };
}
