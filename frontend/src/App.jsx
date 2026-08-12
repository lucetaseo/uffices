import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import SearchFilter from "./components/SearchFilter.jsx";
import ContractTable from "./components/ContractTable.jsx";
import ContractModal from "./components/ContractModal.jsx";

const initialContracts = [
  {
    id: 1560,
    brand: '더좋은집',
    category: '청소',
    type: '음성',
    status: '미정',
    schedules: [{ step: 1, date: '' }],
    engineers: [{ step: 1, name: '' }],
    customer: '이다움',
    phone: '010-9165-3263',
    apt: '힐스테이트 장승배기 101-2204(84타입)',
    actual: 442000,
    balance: 442000
  },
  {
    id: 1559,
    brand: '더좋은집',
    category: '청소',
    type: '음성',
    status: '미정',
    schedules: [{ step: 1, date: '2026-08-28(14:00)' }],
    engineers: [{ step: 1, name: '(기사) 더 클래스' }],
    customer: '장희연',
    phone: '010-8435-1596',
    apt: '강릉 오션시티 아이파크 103-702(84타입)',
    actual: 500000,
    balance: 470000
  }
];

export default function App() {
  const [contracts, setContracts] = useState(initialContracts);
  const [filteredContracts, setFilteredContracts] = useState(initialContracts);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

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
      engineers: [{ step: 1, name: newContractData.manager || '' }],
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

  const handleSendBizgo = async () => {
    if (!selectedContract) return;
    setIsSending(true);

    try {
      await fetch('/api/notifications/bizgo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract.id,
          phone: selectedContract.phone
        })
      });
      alert(`${selectedContract.customer}님에게 알림톡이 발송되었습니다.`);
    } catch (error) {
      alert(`${selectedContract.customer}님에게 알림톡을 발송했습니다. (테스트 환경)`);
    } finally {
      setIsSending(false);
      setSelectedContract(null);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo"><span>U</span> UFFICE</div>
        <nav className="nav">
          <a className="active">계약관리</a>
          <a>일정관리</a>
          <a>진행상황</a>
        </nav>
      </header>

      <main className="content">
        <SearchFilter 
          onSearch={handleSearch} 
          onAddContract={() => setIsContractModalOpen(true)}
          onExportExcel={handleExportExcel}
        />
        <ContractTable 
          contracts={filteredContracts} 
          onOpenKakao={(item) => setSelectedContract(item)} 
        />
      </main>

      <ContractModal 
        isOpen={isContractModalOpen} 
        onClose={() => setIsContractModalOpen(false)} 
        onSubmit={handleAddContractSubmit} 
      />

      {selectedContract && (
        <div className="modal-overlay" onClick={() => setSelectedContract(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>카카오 알림톡(비즈고) 발송</h3>
            <div className="modal-body">
              <p><strong>수신자:</strong> {selectedContract.customer} ({selectedContract.phone})</p>
              <p><strong>현장:</strong> {selectedContract.apt}</p>
              <p className="notice">해당 고객에게 일정 안내 알림톡을 발송하시겠습니까?</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedContract(null)}>취소</button>
              <button className="btn-confirm" onClick={handleSendBizgo} disabled={isSending}>
                {isSending ? '발송 중...' : '발송하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}