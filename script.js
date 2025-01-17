// CSV 데이터를 파싱하는 함수
function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    
    return lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                const value = values[index] ? values[index].trim() : '';
                // 숫자 데이터 변환
                if (['조회수치', '대비율', '현재가', '대비가', '조회비중'].includes(header)) {
                    row[header] = parseFloat(value) || 0;
                } else if (['순위', '전체종목수'].includes(header)) {
                    row[header] = parseInt(value) || 0;
                } else {
                    row[header] = value;
                }
            });
            return row;
        });
}

// 전역 변수 선언
let stockData = [];
let sectorMap = {};
let selectedSectors = new Set(); // 선택된 업종 저장
let allSectors = []; // 모든 업종 정보 저장
let top50Stocks = new Set(); // 시가총액 상위 50개 종목 저장

// 업종 이름 매핑
const SECTOR_NAMES = {
    "172": "소프트웨어 & IT서비스",
    "163": "반도체 & 반도체 장비",
    "282": "컴퓨터, 전화 & 가전",
    "201": "다양한 소매",
    "157": "제약",
    "127": "은행 서비스",
    "150": "헬스케어 장비 & 용품",
    "263": "투자은행 & 투자 서비스",
    "71": "자동차 & 자동차부품",
    "5": "석유 & 가스",
    "236": "기계, 철도차량 & 조선",
    "144": "주택 & 상업용 리츠",
    "136": "보험",
    "182": "전기 유틸리티",
    "242": "전문 & 상업 서비스",
    "36": "항공우주 & 방위",
    "153": "헬스케어 서비스",
    "87": "호텔 & 엔터테인먼트 서비스",
    "122": "식품 & 약품 소매",
    "202": "전문 소매"
};

// CSV 데이터 로드 함수
async function loadCSVData() {
    try {
        // 주식 데이터 로드
        const stockResponse = await fetch('./히트맵.csv');
        const stockText = await stockResponse.text();
        stockData = parseCSV(stockText);

        // 상위 50개 종목 선정
        top50Stocks = new Set(
            stockData
                .sort((a, b) => b.조회수치 - a.조회수치)
                .slice(0, 50)
                .map(stock => stock.종목코드)
        );

        // 업종별 데이터 로드
        const sectorResponse = await fetch('./업종별.csv');
        const sectorText = await sectorResponse.text();
        const sectorRows = parseCSV(sectorText);
        
        // 업종 데이터 매핑 업데이트
        sectorMap = {};
        allSectors = []; // 모든 업종 정보 초기화
        sectorRows.forEach(row => {
            const sectorInfo = {
                code: row.업종그룹,
                name: row.업종명,
                대비율: parseFloat(row.대비율) || 0,
                전체종목수: parseInt(row.전체종목수) || 0,
                조회수치: parseInt(row.조회수치) || 0,
                조회비중: parseFloat(row.조회비중) || 0
            };
            sectorMap[row.업종그룹] = sectorInfo;
            allSectors.push(sectorInfo);
        });

        // 초기 상위 12개 업종 선택
        selectedSectors = new Set(
            allSectors
                .sort((a, b) => b.조회수치 - a.조회수치)
                .slice(0, 12)
                .map(sector => sector.code)
        );

        // 초기 차트 표시
        showTab('stock');
        
        // 업종 선택 모달 초기화
        initializeSectorModal();
    } catch (error) {
        console.error('CSV 데이터 로드 중 오류 발생:', error);
    }
}

// 색상 계산 함수 수정
function getColor(value) {
    // -3% ~ 3% 범위로 조정
    const MAX_RANGE = 3;
    
    // 값을 -3 ~ 3 범위로 제한
    value = Math.max(-MAX_RANGE, Math.min(MAX_RANGE, value));
    
    // 정확히 0인 경우만 회색으로 표시
    if (value === 0) {
        return '#333333';
    }
    
    // 비선형 스케일링
    const getNonLinearScale = (x) => {
        return Math.pow(Math.abs(x) / MAX_RANGE, 0.7);
    };
    
    if (value < 0) {
        // 빨간색 계열 (-3% ~ 0%)
        const scale = getNonLinearScale(value);
        const red = Math.round(100 + 70 * scale);
        return `rgb(${red}, 0, 0)`;
    } else {
        // 초록색 계열 (0% ~ 3%)
        const scale = getNonLinearScale(value);
        const green = Math.round(100 + 70 * scale);
        return `rgb(0, ${green}, 0)`;
    }
}

// 기본 글로벌 기업 아이콘 URL
const DEFAULT_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Business_logo.svg';

// 회사 로고 URL 매핑
const companyLogos = {
    '애플': 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    '엔비디아': 'https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg',
    '마이크로소프트': 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg',
    '알파벳 Class A': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
    '아마존닷컴': 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    '메타 플랫폼스': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg',
    '테슬라': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Tesla_logo.png',
    '브로드컴': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Broadcom_Corporation_logo.svg',
    '타이완 반도체 매뉴팩처링 ADR': 'https://upload.wikimedia.org/wikipedia/commons/7/7d/TSMC_Logo.svg',
    '월마트': 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Walmart_logo.svg'
};

// 트리맵 데이터 생성 함수 수정
function createTreemapData(count) {
    return stockData.slice(0, count).map(stock => {
        // 티커 추출 (USA 제거)
        const ticker = stock.종목코드.replace('USA', '');
        
        const data = {
            name: ticker, // 종목명 대신 티커 사용
            fullName: stock.종목명, // 툴팁용 전체 종목명 저장
            value: stock.조회수치,
            colorValue: stock.대비율,
            color: getColor(stock.대비율)
        };

        // 상위 10개 종목에 대해서만 로고 추가
        if (count <= 10) {
            data.logo = companyLogos[stock.종목명] || DEFAULT_LOGO;
        }

        return data;
    });
}

// 트리맵 차트 생성 함수 수정
function createTreemap(data) {
    const width = window.innerWidth;
    const height = window.innerHeight - 140;

    Highcharts.chart('stock-treemap', {
        chart: {
            width: width,
            height: height,
            animation: false,
            spacing: [0, 0, 0, 0]
        },
        plotOptions: {
            series: {
                animation: false,
                layoutAlgorithm: {
                    aspectRatio: 1.2,
                    threshold: 0.1
                }
            }
        },
        series: [{
            type: 'treemap',
            layoutAlgorithm: 'squarified',
            data: data,
            dataLabels: {
                enabled: true,
                align: 'center',
                verticalAlign: 'middle',
                style: {
                    textOutline: 'none',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    width: '100%',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                },
                useHTML: true,
                formatter: function() {
                    // 영역의 너비와 높이 계산
                    const width = this.point.shapeArgs.width;
                    const height = this.point.shapeArgs.height;
                    
                    // 최소 표시 크기 설정 (픽셀)
                    const MIN_DISPLAY_SIZE = 50;
                    
                    // 영역이 너무 작으면 레이블 숨김
                    if (width < MIN_DISPLAY_SIZE || height < MIN_DISPLAY_SIZE) {
                        return '';
                    }

                    // 영역 크기에 따른 글자 크기 계산
                    const area = width * height;
                    const MIN_FONT_SIZE = 12;
                    const MAX_FONT_SIZE = 24;
                    const BASE_AREA = 10000;
                    
                    // 영역 크기에 비례하여 글자 크기 계산 (로그 스케일 적용)
                    const fontSize = Math.min(
                        MAX_FONT_SIZE,
                        Math.max(
                            MIN_FONT_SIZE,
                            Math.floor(MIN_FONT_SIZE + (Math.log(area / BASE_AREA + 1) * 4))
                        )
                    );
                    
                    return `<div style="font-size: ${fontSize}px; line-height: 1.2;">
                        ${this.point.name}<br>
                        ${this.point.colorValue.toFixed(2)}%
                    </div>`;
                }
            },
            tooltip: {
                useHTML: true,
                headerFormat: '',
                pointFormat: `<div style="font-size: 12px;">
                    <b>{point.fullName}</b><br/>
                    조회수: {point.value:,.0f}<br/>
                    대비율: {point.colorValue:.2f}%
                </div>`
            }
        }],
        title: {
            text: undefined
        },
        credits: {
            enabled: false
        }
    });
}

// 업종 선택 모달 초기화
function initializeSectorModal() {
    const modal = document.querySelector('.filter-modal');
    const backdrop = document.querySelector('.modal-backdrop');
    const filterBtn = document.querySelector('.filter-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const applyBtn = modal.querySelector('.apply-btn');
    const sectorList = modal.querySelector('.sector-list');

    // 모달 열기
    filterBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        backdrop.style.display = 'block';
        updateSectorList();
    });

    // 모달 닫기
    function closeModal() {
        modal.style.display = 'none';
        backdrop.style.display = 'none';
    }

    cancelBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    // 적용 버튼
    applyBtn.addEventListener('click', () => {
        closeModal();
        createSectorTreemap(createSectorTreemapData());
        updateSelectedCount();
    });

    // 초기 업종 목록 생성
    updateSectorList();
}

// 업종 목록 업데이트
function updateSectorList() {
    const sectorList = document.querySelector('.sector-list');
    sectorList.innerHTML = '';

    // 조회수치 기준으로 정렬
    allSectors.sort((a, b) => b.조회수치 - a.조회수치)
        .forEach(sector => {
            const item = document.createElement('div');
            item.className = `sector-item ${selectedSectors.has(sector.code) ? 'selected' : ''}`;
            item.innerHTML = `
                <input type="checkbox" ${selectedSectors.has(sector.code) ? 'checked' : ''}>
                <span>${sector.name}</span>
            `;

            item.addEventListener('click', () => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                
                if (checkbox.checked) {
                    if (selectedSectors.size >= 12) {
                        checkbox.checked = false;
                        alert('최대 12개까지만 선택할 수 있습니다.');
                        return;
                    }
                    selectedSectors.add(sector.code);
                    item.classList.add('selected');
                } else {
                    selectedSectors.delete(sector.code);
                    item.classList.remove('selected');
                }
                
                updateSelectedCount();
            });

            sectorList.appendChild(item);
        });
}

// 선택된 업종 수 업데이트
function updateSelectedCount() {
    const counts = document.querySelectorAll('.selected-count');
    counts.forEach(count => {
        count.textContent = `(${selectedSectors.size}/12)`;
    });
}

// 업종별 트리맵 데이터 생성 함수 수정
function createSectorTreemapData() {
    // 업종별로 주식 데이터 그룹화
    const sectorGroups = {};
    stockData.forEach(stock => {
        const sectorCode = stock.업종그룹;
        const sector = sectorMap[sectorCode];
        if (sector && selectedSectors.has(sectorCode)) {
            if (!sectorGroups[sectorCode]) {
                sectorGroups[sectorCode] = {
                    id: sectorCode,
                    name: sector.name || SECTOR_NAMES[sectorCode],
                    value: sector.조회수치 || 0,
                    colorValue: sector.대비율 || 0,
                    color: getColor(sector.대비율 || 0),
                    대비율: sector.대비율 || 0,
                    전체종목수: sector.전체종목수 || 0,
                    조회수치: sector.조회수치 || 0,
                    조회비중: sector.조회비중 || 0,
                    stocks: []  // 업종 내 종목들을 저장할 배열
                };
            }
            sectorGroups[sectorCode].stocks.push(stock);
        }
    });

    // 각 업종 내에서 종목들을 조회수치 기준으로 정렬하고 상위 7개만 유지
    Object.values(sectorGroups).forEach(sector => {
        sector.stocks.sort((a, b) => b.조회수치 - a.조회수치);
        sector.stocks = sector.stocks.slice(0, 7);
    });

    return Object.values(sectorGroups);
}

// 업종별 트리맵 생성 함수 수정
function createSectorTreemap(data) {
    if (!data || data.length === 0) {
        console.error('업종별 데이터가 없습니다.');
        return;
    }

    const container = document.getElementById('sector-treemap');
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = window.innerWidth <= 540 ? '1fr' : 'repeat(2, 1fr)';
    container.style.gap = '10px';
    container.style.height = 'auto';
    container.style.overflowY = 'auto';

    data.forEach((sector, index) => {
        const sectorDiv = document.createElement('div');
        sectorDiv.style.height = window.innerWidth <= 540 ? '600px' : '500px';
        sectorDiv.className = 'sector-chart';
        container.appendChild(sectorDiv);

        // 업종 내 종목들의 트리맵 데이터 생성
        const sectorData = [{
            id: sector.id,
            name: sector.name,
            value: 10,  // 업종 영역의 크기를 최소화
            color: sector.color
        }];

        // 상위 7개 종목 데이터 추가
        sector.stocks.forEach(stock => {
            sectorData.push({
                name: stock.종목코드.replace('USA', ''),
                value: stock.조회수치,
                colorValue: stock.대비율,
                color: getColor(stock.대비율)
            });
        });

        Highcharts.chart(sectorDiv, {
            chart: {
                type: 'treemap',
                height: window.innerWidth <= 540 ? 600 : 500,
                spacing: [0, 0, 0, 0],
                animation: false,
                events: {
                    click: function() {
                        showSectorDetail(sector);
                    }
                }
            },
            plotOptions: {
                series: {
                    animation: false,
                    layoutAlgorithm: {
                        aspectRatio: 1.2,
                        threshold: 0.1
                    }
                }
            },
            title: {
                text: sector.name,
                align: 'left',
                style: {
                    fontSize: '14px',
                    fontWeight: 'bold'
                },
                margin: 5,
                x: 5
            },
            subtitle: {
                text: undefined
            },
            series: [{
                type: 'treemap',
                layoutAlgorithm: 'squarified',
                data: sectorData,
                dataLabels: {
                    enabled: true,
                    align: 'center',
                    verticalAlign: 'middle',
                    style: {
                        textOutline: 'none',
                        fontWeight: 'bold',
                        color: '#ffffff',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                        width: '100%',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    },
                    useHTML: true,
                    formatter: function() {
                        const isMainSector = this.point.id === sector.id;
                        if (isMainSector) {
                            return '';
                        }

                        // 영역의 너비와 높이 계산
                        const width = this.point.shapeArgs.width;
                        const height = this.point.shapeArgs.height;
                        
                        // 최소 표시 크기 설정 (픽셀)
                        const MIN_DISPLAY_SIZE = 45;
                        
                        // 영역이 너무 작으면 레이블 숨김
                        if (width < MIN_DISPLAY_SIZE || height < MIN_DISPLAY_SIZE) {
                            return '';
                        }

                        // 영역 크기에 따른 글자 크기 계산
                        const area = width * height;
                        const MIN_FONT_SIZE = 12;
                        const MAX_FONT_SIZE = 24;
                        const BASE_AREA = 10000;
                        
                        // 영역 크기에 비례하여 글자 크기 계산 (로그 스케일 적용)
                        const fontSize = Math.min(
                            MAX_FONT_SIZE,
                            Math.max(
                                MIN_FONT_SIZE,
                                Math.floor(MIN_FONT_SIZE + (Math.log(area / BASE_AREA + 1) * 3.5))
                            )
                        );
                        
                        // 줄 간격 조정을 위한 line-height 추가
                        return `<div style="font-size: ${fontSize}px; line-height: 1.2;">
                            ${this.point.name}<br>
                            ${this.point.colorValue.toFixed(2)}%
                        </div>`;
                    }
                }
            }],
            tooltip: { enabled: false },
            credits: { enabled: false }
        });
    });
}

// 업종 상세 보기 표시
function showSectorDetail(sector) {
    const popup = document.querySelector('.fullpage-popup');
    const title = popup.querySelector('.fullpage-title');
    title.textContent = sector.name;
    
    const width = window.innerWidth;
    const height = window.innerHeight - 60; // 헤더 영역만 고려

    // 해당 업종의 종목들만 필터링
    const sectorStocks = stockData.filter(stock => stock.업종그룹 === sector.id);
    
    // 상세 트리맵 생성
    Highcharts.chart('detail-treemap', {
        chart: {
            width: width,
            height: height,
            animation: false,
            spacing: [0, 0, 0, 0]
        },
        plotOptions: {
            series: {
                animation: false,
                layoutAlgorithm: {
                    aspectRatio: 1.2,
                    threshold: 0.1
                }
            }
        },
        series: [{
            type: 'treemap',
            layoutAlgorithm: 'squarified',
            data: sectorStocks.map(stock => ({
                name: stock.종목코드.replace('USA', ''),
                value: stock.조회수치,
                colorValue: stock.대비율,
                color: getColor(stock.대비율),
                stockData: stock
            })),
            dataLabels: {
                enabled: true,
                align: 'center',
                verticalAlign: 'middle',
                style: {
                    textOutline: 'none',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    width: '100%',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                },
                useHTML: true,
                formatter: function() {
                    // 영역의 너비와 높이 계산
                    const width = this.point.shapeArgs.width;
                    const height = this.point.shapeArgs.height;
                    
                    // 최소 표시 크기 설정 (픽셀)
                    const MIN_DISPLAY_SIZE = 45;
                    
                    // 영역이 너무 작으면 레이블 숨김
                    if (width < MIN_DISPLAY_SIZE || height < MIN_DISPLAY_SIZE) {
                        return '';
                    }

                    // 영역 크기에 따른 글자 크기 계산
                    const area = width * height;
                    const MIN_FONT_SIZE = 12;
                    const MAX_FONT_SIZE = 24;
                    const BASE_AREA = 10000;
                    
                    // 영역 크기에 비례하여 글자 크기 계산 (로그 스케일 적용)
                    const fontSize = Math.min(
                        MAX_FONT_SIZE,
                        Math.max(
                            MIN_FONT_SIZE,
                            Math.floor(MIN_FONT_SIZE + (Math.log(area / BASE_AREA + 1) * 3.5))
                        )
                    );
                    
                    // 줄 간격 조정을 위한 line-height 추가
                    return `<div style="font-size: ${fontSize}px; line-height: 1.2;">
                        ${this.point.name}<br>
                        ${this.point.colorValue.toFixed(2)}%
                    </div>`;
                }
            }
        }],
        title: {
            text: sector.name,
            align: 'left',
            style: {
                fontSize: '16px',
                fontWeight: 'bold'
            }
        },
        credits: { enabled: false }
    });
    
    popup.style.display = 'block';
}

// 종목 상세 정보 표시
function showStockDetail(stock) {
    const bottomSheet = document.querySelector('.bottom-sheet');
    const title = bottomSheet.querySelector('.bottom-sheet-title');
    const content = bottomSheet.querySelector('.stock-info');
    
    // 종목 데이터 찾기
    const stockInfo = stock.stockData || stockData.find(s => s.종목코드 === stock.id);
    if (!stockInfo) return;
    
    // 제목 설정
    title.textContent = stockInfo.종목명;
    
    // 상세 정보 생성
    content.innerHTML = `
        <dt>종목코드</dt>
        <dd>${stockInfo.종목코드}</dd>
        <dt>현재가</dt>
        <dd>${stockInfo.현재가.toLocaleString()}원</dd>
        <dt>대비구분</dt>
        <dd>${stockInfo.대비구분}</dd>
        <dt>대비가</dt>
        <dd>${stockInfo.대비가.toLocaleString()}원</dd>
        <dt>대비율</dt>
        <dd>${stockInfo.대비율.toFixed(2)}%</dd>
        <dt>조회수치</dt>
        <dd>${stockInfo.조회수치.toLocaleString()}</dd>
        <dt>조회비중</dt>
        <dd>${stockInfo.조회비중.toFixed(2)}%</dd>
    `;
    
    // 바텀시트 표시
    bottomSheet.style.display = 'block';
    setTimeout(() => bottomSheet.classList.add('show'), 10);
}

// 탭 전환 함수
function showTab(tabId) {
    // 모든 차트 컨테이너 숨기기
    document.getElementById('stock-treemap').style.display = 'none';
    document.getElementById('sector-treemap').style.display = 'none';
    
    // 컨트롤 표시/숨김 처리
    document.getElementById('stock-controls').style.display = 
        tabId === 'stock' ? 'block' : 'none';
    document.getElementById('sector-controls').style.display = 
        tabId === 'sector' ? 'block' : 'none';
    
    // 선택된 탭의 차트 표시
    if (tabId === 'stock') {
        document.getElementById('stock-treemap').style.display = 'block';
        const slider = document.querySelector('.count-slider');
        createTreemap(createTreemapData(parseInt(slider.value)));
    } else {
        document.getElementById('sector-treemap').style.display = 'block';
        createSectorTreemap(createSectorTreemapData());
    }
}

// 반응형 처리 수정
function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight - 140;

    // 현재 활성화된 탭 확인
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;

    if (activeTab === 'stock') {
        const stockChart = document.querySelector('#stock-treemap');
        if (stockChart.highcharts) {
            stockChart.highcharts.setSize(width, height, false);
        }
    } else {
        // 업종별 차트 다시 그리기
        createSectorTreemap(createSectorTreemapData());
    }
}

window.addEventListener('resize', handleResize);

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    // CSV 데이터 로드
    loadCSVData();

    // 탭 이벤트 리스너
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            // 활성 탭 스타일 변경
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            // 탭 전환
            showTab(e.target.dataset.tab);
        });
    });

    // 슬라이더 이벤트 리스너
    const slider = document.querySelector('.count-slider');
    const label = document.querySelector('.count-label');
    
    slider.addEventListener('input', function(e) {
        const count = parseInt(e.target.value);
        label.textContent = `표시 종목: ${count}개`;
        createTreemap(createTreemapData(count));
    });

    // 초기 트리맵 표시 (7개로 시작)
    showTab('stock');

    // 팝업 닫기 버튼 이벤트
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const popup = this.closest('.fullpage-popup');
            const bottomSheet = this.closest('.bottom-sheet');
            
            if (popup) {
                popup.style.display = 'none';
            }
            if (bottomSheet) {
                bottomSheet.classList.remove('show');
                setTimeout(() => bottomSheet.style.display = 'none', 300);
            }
        });
    });
    
    // 바텀시트 드래그로 닫기
    const bottomSheet = document.querySelector('.bottom-sheet');
    let startY;
    let startTransform;
    
    bottomSheet.addEventListener('touchstart', function(e) {
        startY = e.touches[0].clientY;
        startTransform = parseInt(getComputedStyle(this).transform.split(',')[5]) || 0;
    });
    
    bottomSheet.addEventListener('touchmove', function(e) {
        if (!startY) return;
        
        const deltaY = e.touches[0].clientY - startY;
        if (deltaY > 0) {
            this.style.transform = `translateY(${deltaY}px)`;
        }
    });
    
    bottomSheet.addEventListener('touchend', function(e) {
        if (!startY) return;
        
        const deltaY = e.changedTouches[0].clientY - startY;
        if (deltaY > 100) {
            this.classList.remove('show');
            setTimeout(() => {
                this.style.display = 'none';
                this.style.transform = '';
            }, 300);
        } else {
            this.style.transform = '';
        }
        startY = null;
    });
}); 