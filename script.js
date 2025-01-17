// CSV 데이터를 파싱하는 함수
function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(header => header.trim().replace(/^["']|["']$/g, ''));
    
    return lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, index) => {
                const value = values[index] ? values[index].trim().replace(/^["']|["']$/g, '') : '';
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

    } catch (error) {
        console.error('CSV 데이터 로드 중 오류 발생:', error);
        throw error;
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
    return stockData.slice(0, count).map(stock => ({
        name: stock.종목코드.replace('USA', ''),
        value: stock.조회수치,
        colorValue: stock.대비율,
        color: getColor(stock.대비율),
        stockData: stock
    }));
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

// 업종별 트리맵 데이터 생성 함수
function createSectorTreemapData() {
    return allSectors.map(sector => ({
        ...sector,
        value: sector.조회수치,
        colorValue: sector.대비율,
        color: getColor(sector.대비율)
    }));
}

// 업종별 트리맵 생성 함수 수정
function createSectorTreemap(data) {
    if (!data || data.length === 0) {
        console.error('업종별 데이터가 없습니다.');
        return;
    }

    // 상단 12개 업종 그리드 생성
    const sectorGrid = document.querySelector('.sector-grid');
    const sectorDetails = document.querySelector('.sector-details');
    
    if (!sectorGrid || !sectorDetails) {
        console.error('Required elements not found');
        return;
    }
    
    sectorGrid.innerHTML = '';
    sectorDetails.innerHTML = '';

    // 모든 차트 설정을 미리 준비
    const chartConfigs = data.map(sector => {
        const sectorStocks = stockData
            .filter(stock => stock.업종그룹 === sector.code)
            .sort((a, b) => b.조회수치 - a.조회수치)
            .slice(0, 20)
            .map(stock => ({
                name: stock.종목코드.replace('USA', ''),
                value: stock.조회수치,
                colorValue: stock.대비율,
                color: getColor(stock.대비율),
                stockData: stock
            }));

        return {
            sector,
            config: {
                chart: {
                    type: 'treemap',
                    height: 300,
                    animation: false
                },
                title: { text: null },
                series: [{
                    layoutAlgorithm: 'squarified',
                    animation: false,
                    data: sectorStocks,
                    dataLabels: {
                        enabled: true,
                        formatter: function() {
                            return this.point.name;
                        }
                    },
                    events: {
                        click: function(e) {
                            if (e.point.stockData) {
                                showStockDetail(e.point);
                            }
                        }
                    }
                }],
                credits: { enabled: false }
            }
        };
    });

    // DOM 요소 생성 및 차트 렌더링
    chartConfigs.forEach(({ sector, config }) => {
        // 그리드 아이템 생성
        const gridItem = document.createElement('div');
        gridItem.className = 'sector-grid-item';
        gridItem.style.backgroundColor = getColor(sector.대비율);
        gridItem.innerHTML = `
            <div class="sector-name">${sector.name}</div>
            <div class="sector-value">${sector.대비율.toFixed(2)}%</div>
        `;
        
        gridItem.addEventListener('click', () => {
            const detailItem = document.getElementById(`sector-${sector.code}`);
            if (detailItem) {
                detailItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        
        sectorGrid.appendChild(gridItem);

        // 상세 영역 생성
        const detailContainer = document.createElement('div');
        detailContainer.className = 'sector-detail-container';
        detailContainer.id = `sector-${sector.code}`;

        const detailHeader = document.createElement('div');
        detailHeader.className = 'sector-detail-header';
        detailHeader.innerHTML = `
            <h3 class="sector-detail-title">${sector.name}</h3>
            <button class="sector-detail-shortcut">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 17L17 7M17 7H8M17 7V16"/>
                </svg>
                상세보기
            </button>
        `;

        const detailItem = document.createElement('div');
        detailItem.className = 'sector-detail-item';

        detailContainer.appendChild(detailHeader);
        detailContainer.appendChild(detailItem);
        sectorDetails.appendChild(detailContainer);

        detailHeader.querySelector('.sector-detail-shortcut').addEventListener('click', () => {
            showSectorDetail(sector);
        });

        // 차트 렌더링
        if (config.series[0].data.length > 0) {
            Highcharts.chart(detailItem, config);
        }
    });
}

// 업종 상세 보기 표시 함수 수정
function showSectorDetail(sector) {
    const popup = document.querySelector('.fullpage-popup');
    const title = popup.querySelector('.fullpage-title');
    title.textContent = sector.name;
    
    const width = window.innerWidth;
    const height = window.innerHeight - 94; // 헤더와 슬라이더 높이만큼 제외

    // 해당 업종의 모든 종목을 조회수치로 정렬
    const allStocks = stockData
        .filter(stock => stock.업종그룹 === sector.code)
        .sort((a, b) => b.조회수치 - a.조회수치);

    if (allStocks.length === 0) {
        console.error('해당 업종의 종목이 없습니다:', sector.code);
        return;
    }

    // 슬라이더 설정
    const sliderContainer = popup.querySelector('.slider-container');
    const slider = sliderContainer.querySelector('.count-slider');
    const label = sliderContainer.querySelector('.count-label');
    
    // 슬라이더 범위 설정
    const minCount = Math.min(5, allStocks.length);
    const maxCount = allStocks.length;
    slider.min = minCount;
    slider.max = maxCount;
    slider.value = Math.min(20, maxCount); // 초기값은 20개 또는 최대 종목 수
    
    // 슬라이더 레이블 업데이트
    function updateLabel() {
        label.textContent = `표시 종목: ${slider.value}개`;
    }
    updateLabel();

    // 트리맵 생성 함수
    function createDetailTreemap(count) {
        const sectorStocks = allStocks
            .slice(0, count)
            .map(stock => ({
                name: stock.종목코드.replace('USA', ''),
                value: stock.조회수치,
                colorValue: stock.대비율,
                color: getColor(stock.대비율),
                stockData: stock
            }));
        
        Highcharts.chart('detail-treemap', {
            series: [{
                type: 'treemap',
                data: sectorStocks,
                animation: false,
                events: {
                    click: function(e) {
                        if (e.point.stockData) {
                            showStockDetail(e.point);
                        }
                    }
                },
                dataLabels: {
                    enabled: true,
                    formatter: function() {
                        if (!this.point || !this.point.shapeArgs) return '';
                        
                        const width = this.point.shapeArgs.width;
                        const height = this.point.shapeArgs.height;
                        
                        const MIN_DISPLAY_SIZE = 45;
                        if (width < MIN_DISPLAY_SIZE || height < MIN_DISPLAY_SIZE) {
                            return '';
                        }

                        return `${this.point.name}<br>${this.point.colorValue.toFixed(2)}%`;
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
            chart: {
                width: width,
                height: height,
                animation: false,
                spacing: [0, 0, 0, 0]
            },
            plotOptions: {
                series: {
                    animation: false,
                    layoutAlgorithm: 'squarified'
                }
            },
            tooltip: { enabled: false },
            credits: { enabled: false }
        });
    }

    // 슬라이더 이벤트 리스너
    slider.addEventListener('input', function() {
        updateLabel();
        createDetailTreemap(parseInt(this.value));
    });

    // 초기 트리맵 생성
    createDetailTreemap(parseInt(slider.value));
    
    // 팝업 표시
    popup.style.display = 'block';
    sliderContainer.style.display = 'flex';
}

// 종목 상세 정보 표시
function showStockDetail(stock) {
    const bottomSheet = document.querySelector('.bottom-sheet');
    const backdrop = document.querySelector('.bottom-sheet-backdrop');
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
    
    // 바텀시트와 딤 표시
    backdrop.style.display = 'block';
    bottomSheet.style.display = 'block';
    
    // 애니메이션을 위해 약간의 지연 후 클래스 추가
    setTimeout(() => {
        backdrop.classList.add('show');
        bottomSheet.classList.add('show');
    }, 10);
}

// 바텀시트 닫기 함수
function closeBottomSheet() {
    const bottomSheet = document.querySelector('.bottom-sheet');
    const backdrop = document.querySelector('.bottom-sheet-backdrop');
    
    bottomSheet.classList.remove('show');
    backdrop.classList.remove('show');
    
    // 애니메이션 완료 후 display none 처리
    setTimeout(() => {
        bottomSheet.style.display = 'none';
        backdrop.style.display = 'none';
        bottomSheet.style.transform = '';
    }, 300);
}

// 탭 전환 함수
function showTab(tabId) {
    // 탭 스타일 업데이트
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // 슬라이더 컨트롤 표시/숨김
    const sliderContainer = document.querySelector('.slider-container');
    if (sliderContainer) {
        sliderContainer.style.display = tabId === 'stock' ? 'flex' : 'none';
    }
    
    // 차트 표시/숨김
    const stockTreemap = document.getElementById('stock-treemap');
    const sectorTreemap = document.getElementById('sector-treemap');
    
    if (stockTreemap && sectorTreemap) {
        if (tabId === 'stock') {
            stockTreemap.style.display = 'block';
            sectorTreemap.style.display = 'none';
            const slider = document.querySelector('.count-slider');
            if (slider) {
                createTreemap(createTreemapData(parseInt(slider.value)));
            }
        } else {
            stockTreemap.style.display = 'none';
            sectorTreemap.style.display = 'block';
            
            // 업종별 데이터 생성
            const sectors = Object.entries(SECTOR_NAMES).map(([code, name]) => {
                const stocks = stockData.filter(stock => stock.업종그룹 === code);
                const totalViews = stocks.reduce((sum, stock) => sum + stock.조회수치, 0);
                const avgChange = stocks.reduce((sum, stock) => sum + stock.대비율, 0) / (stocks.length || 1);
                
                return {
                    code,
                    name,
                    조회수치: totalViews,
                    대비율: avgChange
                };
            });

            // 조회수치 기준으로 정렬하고 상위 12개 선택
            const sectorData = sectors
                .sort((a, b) => b.조회수치 - a.조회수치)
                .slice(0, 12);

            createSectorTreemap(sectorData);
        }
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
    loadCSVData().then(() => {
        // 탭 이벤트 리스너
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                showTab(tab.dataset.tab);
            });
        });

        // 슬라이더 이벤트 리스너
        const slider = document.querySelector('.count-slider');
        const label = document.querySelector('.count-label');
        
        if (slider && label) {
            slider.addEventListener('input', function(e) {
                const count = parseInt(e.target.value);
                label.textContent = `표시 종목: ${count}개`;
                createTreemap(createTreemapData(count));
            });
        }

        // 초기 트리맵 표시
        showTab('stock');
    });

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
    
    // 바텀시트 딤 클릭 이벤트
    const backdrop = document.querySelector('.bottom-sheet-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', closeBottomSheet);
    }

    // 바텀시트 드래그로 닫기
    const bottomSheet = document.querySelector('.bottom-sheet');
    let startY;
    let startTransform;
    
    if (bottomSheet) {
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
                closeBottomSheet();
            } else {
                this.style.transform = '';
            }
            startY = null;
        });
    }
}); 
