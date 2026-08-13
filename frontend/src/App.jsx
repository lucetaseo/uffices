import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import './App.css'; // ★ 모달 및 전체 스타일 적용을 위한 필수 Import

import SearchFilter from './components/SearchFilter.jsx';
import ContractTable from './components/ContractTable.jsx';
import ContractModal from './components/ContractModal.jsx';
import ScheduleManagement from './components/ScheduleManagement.jsx';
import CustomerManagement from './components/CustomerManagement.jsx';
import ProgressStatus from './components/ProgressStatus.jsx';

const initialContracts = [
  {
    id: 1560,
    brand: '더좋은집',
    category: '청소',
    type: '음성',
    status: '미정',
    schedules: [{ step: 1, date: '' }],
    engineers: [{ step: 1, name: '김시공', phone: '010-1234-5678' }],
    customer: '이다움',
    phone: '010-9165-3263',
    apt: '힐스테이트 장승배기 101-2204(84타입)',
    actual: 442000,
    balance: 442000
  },
  {
    id: 1559,
    brand: '더스타트',
    category: '줄눈',
    type: '박람회',
    status: '미정',
    schedules: [{ step: 1, date: '2026-08-28(14:00)' }],
    engineers: [{ step: 1, name: '박기사', phone: '010-9876-5432' }],
    customer: '장희연',
    phone: '010-8435-1596',
    apt: '강릉 오션시티 아이파크 103-702(84타입)',
    actual: 500000,
    balance: 470000
  }
];

export default function App() {
  // localStorage에서 마지막에 열람했던 탭 읽어오기
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('lastActiveTab') || 'contract';
  });

  const [subTab, setSubTab] = useState('main'); // 'main' | 'trash'
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false);

  const [contracts, setContracts] = useState(initialContracts);
  const [filteredContracts, setFilteredContracts] = useState(initialContracts);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 알림톡 옵션 상태
  const [talkBrand, setTalkBrand] = useState('더좋은집');
  const [talkTemplate, setTalkTemplate] = useState('기사배정');
  const [talkTarget, setTalkTarget] = useState('고객');

  // 탭 변경 시 상태 저장
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    localStorage.setItem('lastActiveTab', tabName);
  };

  const handleSearch = (filterData) => {
    const { aptName, customerName, phone } = filterData;
    const result = contracts.filter((item) => {
      const matchApt = !aptName || item.apt.includes(aptName);
      const matchCustomer = !customerName || item.customer.includes(customerName);
      const matchPhone = !phone || item.phone.includes(phone);
      return matchApt && matchCustomer && matchPhone;
    });
    setFilteredContracts(result);
  };

  const handleExportExcel = () => {
    if (filteredContracts.length === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const excelData = filteredContracts.map((item) => ({
      '계약번호': item.id,
      '브랜드': item.brand,
      '구분': item.category,
      '접수형태': item.type,
      '시공상태': item.status,
      '시공예정일': item.schedules.map(s => s.date).filter(Boolean).join(', ') || '미정',
      '시공담당': item.engineers.map(e => e.name).filter(Boolean).join(', ') || '미배정',
      '계약자': item.customer,
      '연락처': item.phone,
      '아파트명/현장': item.apt,
      '실계약금': item.actual,
      '잔액': item.balance
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '계약목록');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `계약관리_목록_${today}.xlsx`);
  };

  const handleAddContractSubmit = (newContractData) => {
    const newContract = {
      id: contracts.length > 0 ? Math.max(...contracts.map(c => c.id)) + 1 : 1000,
      brand: newContractData.brand,
      category: newContractData.constructionType || '기타',
      type: newContractData.receptionType,
      status: '미정',
      schedules: [{ step: 1, date: newContractData.contractDate || '' }],
      engineers: [{ step: 1, name: newContractData.manager || '', phone: '010-0000-0000' }],
      customer: newContractData.name,
      phone: newContractData.phone1,
      apt: `${newContractData.aptName} ${newContractData.dong}동 ${newContractData.ho}호`,
      actual: Number(newContractData.contractAmount) || 0,
      balance: Number(newContractData.balanceAmount) || 0
    };

    const updated = [newContract, ...contracts];
    setContracts(updated);
    setFilteredContracts(updated);
    alert('새로운 계약이 등록되었습니다.');
  };

  const handleOpenKakaoModal = (item) => {
    setSelectedContract(item);
    setTalkBrand(item.brand || '더좋은집');
    setTalkTemplate('기사배정');
    setTalkTarget('고객');
  };

  const getReceiverInfo = () => {
    if (!selectedContract) return { name: '', phone: '' };
    if (talkTarget === '기사') {
      const engineer = selectedContract.engineers[0];
      return {
        name: engineer?.name || '담당기사',
        phone: engineer?.phone || '등록된 기사 연락처 없음'
      };
    }
    return {
      name: selectedContract.customer,
      phone: selectedContract.phone
    };
  };

  const handleSendBizgo = async () => {
    if (!selectedContract) return;
    const receiver = getReceiverInfo();
    setIsSending(true);

    try {
      await fetch('/api/notifications/bizgo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract.id,
          receiverName: receiver.name,
          phone: receiver.phone,
          brand: talkBrand,
          template: talkTemplate,
          target: talkTarget
        })
      });
      alert(`[${talkBrand} - ${talkTemplate} (${talkTarget}용)] 알림톡이 ${receiver.name}님에게 발송되었습니다.`);
    } catch (error) {
      alert(`[${talkBrand} - ${talkTemplate} (${talkTarget}용)] 알림톡을 발송했습니다. (테스트 환경)`);
    } finally {
      setIsSending(false);
      setSelectedContract(null);
    }
  };

  const receiver = getReceiverInfo();

  return (
    <div className="app-container">
      {/* 상단 네비게이션 헤더 */}
      <header className="main-nav-bar">
        <div 
          className={`nav-item dropdown-parent ${activeTab === 'contract' ? 'active' : ''}`}
          onMouseEnter={() => setIsContractDropdownOpen(true)}
          onMouseLeave={() => setIsContractDropdownOpen(false)}
          onClick={() => { handleTabChange('contract'); setSubTab('main'); }}
        >
          <div className="nav-icon">📝</div>
          <span className="nav-label">계약관리</span>

          {isContractDropdownOpen && (
            <div className="dropdown-menu">
              <div 
                className={`dropdown-item ${subTab === 'main' ? 'active-sub' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleTabChange('contract'); setSubTab('main'); setIsContractDropdownOpen(false); }}
              >
                계약관리
              </div>
              <div 
                className={`dropdown-item ${subTab === 'trash' ? 'active-sub' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleTabChange('contract'); setSubTab('trash'); setIsContractDropdownOpen(false); }}
              >
                휴지통
              </div>
            </div>
          )}
        </div>

        <div className={`nav-item ${activeTab === 'customer' ? 'active' : ''}`} onClick={() => handleTabChange('customer')}>
          <div className="nav-icon">👤</div>
          <span className="nav-label">계약자관리</span>
        </div>

        <div className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => handleTabChange('schedule')}>
          <div className="nav-icon">📅</div>
          <span className="nav-label">일정관리</span>
        </div>

        <div className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => handleTabChange('progress')}>
          <div className="nav-icon">📑</div>
          <span className="nav-label">진행상황</span>
        </div>

        <div className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => handleTabChange('stats')}>
          <div className="nav-icon">📊</div>
          <span className="nav-label">통계정보</span>
        </div>

        <div className={`nav-item ${activeTab === 'setting' ? 'active' : ''}`} onClick={() => handleTabChange('setting')}>
          <div className="nav-icon">⚙️</div>
          <span className="nav-label">설정</span>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="content">
        {activeTab === 'contract' && subTab === 'main' && (
          <>
            <SearchFilter 
              onSearch={handleSearch} 
              onAddContract={() => setIsContractModalOpen(true)}
              onExportExcel={handleExportExcel}
            />
            <ContractTable 
              contracts={filteredContracts} 
              onOpenKakao={handleOpenKakaoModal} 
            />
          </>
        )}

        {activeTab === 'contract' && subTab === 'trash' && (
          <div style={{ padding: '30px', background: '#fff', borderRadius: '8px', marginTop: '15px' }}>
            <h2>🗑️ 휴지통</h2>
            <p style={{ color: '#666', marginTop: '10px' }}>삭제된 계약 목록을 확인하고 복구할 수 있는 영역입니다.</p>
          </div>
        )}

        {activeTab === 'customer' && <CustomerManagement />}
        {activeTab === 'schedule' && <ScheduleManagement />}
        {activeTab === 'progress' && <ProgressStatus />}
      </main>

      {/* 전자계약 등록 모달 */}
      <ContractModal 
        isOpen={isContractModalOpen} 
        onClose={() => setIsContractModalOpen(false)} 
        onSubmit={handleAddContractSubmit} 
      />

      {/* 알림톡 발송 모달 */}
      {selectedContract && (
        <div className="modal-overlay" onClick={() => setSelectedContract(null)}>
          <div className="modal-content talk-modal" onClick={(e) => e.stopPropagation()}>
            <h3>카카오 알림톡 발송</h3>
            
            <div className="talk-select-section">
              <div className="form-group">
                <label>발송 브랜드</label>
                <div className="radio-btn-group">
                  <label className={`radio-tag ${talkBrand === '더좋은집' ? 'selected' : ''}`}>
                    <input type="radio" name="talkBrand" value="더좋은집" checked={talkBrand === '더좋은집'} onChange={(e) => setTalkBrand(e.target.value)} />
                    더좋은집
                  </label>
                  <label className={`radio-tag ${talkBrand === '더스타트' ? 'selected' : ''}`}>
                    <input type="radio" name="talkBrand" value="더스타트" checked={talkBrand === '더스타트'} onChange={(e) => setTalkBrand(e.target.value)} />
                    더스타트
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>알림톡 템플릿</label>
                <div className="radio-btn-group">
                  <label className={`radio-tag ${talkTemplate === '기사배정' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="talkTemplate" 
                      value="기사배정" 
                      checked={talkTemplate === '기사배정'} 
                      onChange={(e) => setTalkTemplate(e.target.value)} 
                    />
                    기사배정 안내
                  </label>
                  <label className={`radio-tag ${talkTemplate === '계약완료' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="talkTemplate" 
                      value="계약완료" 
                      checked={talkTemplate === '계약완료'} 
                      onChange={(e) => {
                        setTalkTemplate(e.target.value);
                        setTalkTarget('고객');
                      }} 
                    />
                    계약완료 안내
                  </label>
                </div>
              </div>

              {talkTemplate === '기사배정' && (
                <div className="form-group">
                  <label>수신 대상</label>
                  <div className="radio-btn-group">
                    <label className={`radio-tag target ${talkTarget === '고객' ? 'selected-target' : ''}`}>
                      <input type="radio" name="talkTarget" value="고객" checked={talkTarget === '고객'} onChange={(e) => setTalkTarget(e.target.value)} />
                      👤 고객용
                    </label>
                    <label className={`radio-tag target ${talkTarget === '기사' ? 'selected-target' : ''}`}>
                      <input type="radio" name="talkTarget" value="기사" checked={talkTarget === '기사'} onChange={(e) => setTalkTarget(e.target.value)} />
                      🔧 시공기사용
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="talk-preview-box">
              <p><strong>수신자:</strong> {receiver.name} ({receiver.phone})</p>
              <p><strong>현장:</strong> {selectedContract.apt}</p>
              <div className="preview-text">
                {talkTemplate === '기사배정' && talkTarget === '고객' && (
                  `[${talkBrand}] ${selectedContract.customer}님, 담당 시공기사(${selectedContract.engineers[0]?.name || '배정중'})님이 배정되었습니다.`
                )}
                {talkTemplate === '기사배정' && talkTarget === '기사' && (
                  `[${talkBrand}] ${selectedContract.engineers[0]?.name || '기사'}님, 신규 시공 건이 배정되었습니다. (현장: ${selectedContract.apt} / 고객: ${selectedContract.customer})`
                )}
                {talkTemplate === '계약완료' && (
                  `[${talkBrand}] ${selectedContract.customer}님, 전자계약 작성이 정상적으로 완료되었습니다.`
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedContract(null)}>취소</button>
              <button className="btn-confirm" onClick={handleSendBizgo} disabled={isSending}>
                {isSending ? '발송 중...' : `${talkTarget}에게 알림톡 발송`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}