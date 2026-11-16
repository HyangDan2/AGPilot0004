import React, { useState, useEffect } from 'react';
import { useChild } from '../context/ChildContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Users, UserPlus, Trash2, Camera, Shield, Download, AlertTriangle, KeyRound, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const FamilyPage: React.FC = () => {
  const { user, openOtpLogin } = useAuth();
  const { activeChild, refreshChildren, createChild } = useChild();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'caregiver' | 'viewer'>('caregiver');
  const [isUploading, setIsUploading] = useState(false);

  // 6-digit invite code & 2-step approval states
  const [generatedCode, setGeneratedCode] = useState<{ code: string; role: string; expires_at: string } | null>(null);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [myPendingRequests, setMyPendingRequests] = useState<any[]>([]);
  const [joinStatusMsg, setJoinStatusMsg] = useState<string | null>(null);

  // Edit profile state
  const [name, setName] = useState(activeChild?.name || '');
  const [birthDate, setBirthDate] = useState(activeChild?.birth_date || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user && activeChild && !activeChild.id.startsWith('local-')) {
      if (activeChild.role === 'owner') {
        api.getPendingMembers(activeChild.id).then(setPendingMembers).catch(() => setPendingMembers([]));
      }
      api.getMyPendingJoinRequests().then(setMyPendingRequests).catch(() => setMyPendingRequests([]));
    }
  }, [user, activeChild?.id]);

  const handleGenerateCode = async () => {
    if (!activeChild) return;
    try {
      const res = await api.createInviteCode(activeChild.id, inviteRole);
      setGeneratedCode({ code: res.code, role: res.role, expires_at: res.expires_at });
    } catch (err: any) {
      alert(err.message || '초대 코드 발급 실패');
    }
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCodeInput.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      alert('6자리 숫자 초대 코드를 입력해 주세요.');
      return;
    }
    try {
      const res = await api.requestJoinWithCode(clean);
      setJoinStatusMsg(res.message);
      setJoinCodeInput('');
      const mine = await api.getMyPendingJoinRequests().catch(() => []);
      setMyPendingRequests(mine);
      await refreshChildren();
    } catch (err: any) {
      alert(err.message || '초대 코드 요청 실패');
    }
  };

  const handleApproveMember = async (memberId: string) => {
    if (!activeChild) return;
    try {
      await api.approveMember(activeChild.id, memberId);
      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
      await refreshChildren();
    } catch (err: any) {
      alert(err.message || '승인 처리 실패');
    }
  };

  const handleRejectMember = async (memberId: string) => {
    if (!activeChild) return;
    try {
      await api.rejectMember(activeChild.id, memberId);
      setPendingMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      alert(err.message || '거절 처리 실패');
    }
  };

  const handleSyncLocalChildToCloud = async () => {
    if (!activeChild || !user) return;
    try {
      await createChild({
        name: activeChild.name,
        birth_date: activeChild.birth_date,
        sex: activeChild.sex,
        is_premature: activeChild.is_premature,
        due_date: activeChild.due_date,
        gestational_weeks: activeChild.gestational_weeks,
      });
      alert(`'${activeChild.name}' 프로필이 클라우드에 저장되었습니다. 이제 6자리 초대 코드를 발급할 수 있습니다.`);
    } catch (err: any) {
      alert(err.message || '클라우드 동기화 실패');
    }
  };

  if (!activeChild) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {user && (
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-[#E8E4F2] space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#8B6CE8]" />
              <h2 className="text-lg font-extrabold text-[#1D192B]">6자리 초대 코드로 가족 아이 연결하기</h2>
            </div>
            <form onSubmit={handleJoinWithCode} className="flex flex-wrap gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6자리 숫자 입력 (예: 482910)"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                className="flex-1 min-w-[200px] rounded-xl border border-[#E8E4F2] px-4 py-2.5 text-sm font-mono tracking-widest focus:border-[#8B6CE8] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] text-white px-5 py-2.5 text-sm font-bold"
              >
                참여 요청 보내기
              </button>
            </form>
            {joinStatusMsg && <p className="text-xs font-semibold text-[#6B4CD6]">{joinStatusMsg}</p>}
          </div>
        )}
        <div className="rounded-3xl bg-white p-8 text-center border border-[#E8E4F2]">
          <p className="text-sm text-[#68627A]">상단 메뉴에서 새 아이를 등록하거나 6자리 초대 코드를 입력해 주세요.</p>
        </div>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      await api.inviteMember(activeChild.id, inviteEmail.trim(), inviteRole);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      refreshChildren();
      alert('가족 구성원이 성공적으로 초대되었습니다.');
    } catch (err: any) {
      alert(err.message || '초대 실패');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('해당 구성원의 공유 권한을 해제하시겠습니까?')) return;
    try {
      await api.removeMember(activeChild.id, memberId);
      refreshChildren();
    } catch (err: any) {
      alert(err.message || '삭제 실패');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await api.uploadAvatar(activeChild.id, file);
      await refreshChildren();
    } catch (err: any) {
      alert(err.message || '이미지 업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateChild(activeChild.id, {
        name,
        birth_date: birthDate,
      });
      setIsEditing(false);
      refreshChildren();
    } catch (err: any) {
      alert(err.message || '수정 실패');
    }
  };

  const handleExportData = () => {
    const exportObj = {
      child: activeChild,
      exported_at: new Date().toISOString(),
      note: 'HD2Lab BabyCare User Data Export',
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `babycare_${activeChild.name}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">아이 프로필 · 가족 공유</h1>
        <p className="text-sm text-slate-500 mt-1">
          아이 정보 수정, 프로필 사진 변경, 공동 양육자(부모, 조부모, 베이비시터) 초대 및 권한을 관리합니다.
        </p>
      </div>

      {/* 1. Baby Profile Card */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar with upload */}
          <div className="relative group">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-100 text-blue-700 font-black text-3xl shadow-inner overflow-hidden border-2 border-white">
              {activeChild.profile_image_url ? (
                <img
                  src={activeChild.profile_image_url}
                  alt={activeChild.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{activeChild.sex === 'male' ? '👦' : '👧'}</span>
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer transition-colors">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-slate-900">{activeChild.name}</h2>
              <span className="rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-bold">
                {activeChild.sex === 'male' ? '남아' : '여아'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              생년월일: {activeChild.birth_date} (생후 {activeChild.days_since_birth}일, 약 {activeChild.months_since_birth}개월)
            </p>
            {activeChild.is_premature && (
              <p className="text-xs text-amber-700 font-semibold">
                이른둥이 (출산예정일: {activeChild.due_date || '-'} • 교정 {activeChild.corrected_age_months}개월)
              </p>
            )}
            <p className="text-xs text-slate-400">내 권한: {activeChild.role === 'owner' ? '소유자(관리자)' : activeChild.role}</p>
          </div>

          <button
            onClick={() => {
              setName(activeChild.name);
              setBirthDate(activeChild.birth_date);
              setIsEditing(!isEditing);
            }}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {isEditing ? '닫기' : '기본정보 수정'}
          </button>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">아이 이름 / 태명</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">생년월일</label>
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                수정 완료
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Family Members Sharing (Google Auth Crew + 6-digit Code + Owner Approval) */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-[#E8E4F2] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B6CE8]" />
            <h3 className="font-bold text-[#1D192B] text-base">공동 양육 · 가족 공유 (2단계 승인)</h3>
          </div>
          {user && !activeChild.id.startsWith('local-') && activeChild.role === 'owner' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateCode}
                className="flex items-center gap-1.5 rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] text-white px-3.5 py-2 text-xs font-bold transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                6자리 초대 코드 발급
              </button>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[#F4F1FC] text-[#6B4CD6] hover:bg-[#EAE4FA] px-3 py-2 text-xs font-bold transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                이메일 초대
              </button>
            </div>
          )}
        </div>

        {!user ? (
          <div className="rounded-2xl bg-[#F4F1FC] border border-[#E8E4F2] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-bold text-sm text-[#1D192B]">가족과 같은 아이 기록을 함께 보시겠어요?</p>
              <p className="text-xs text-[#68627A]">
                일반 가족 구성원(Crew)은 <strong>이메일 6자리 OTP 로그인</strong> 후 6자리 초대 코드와 주 양육자의 최종 승인을 거쳐 안전하게 아이 데이터를 공유할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={openOtpLogin}
              className="shrink-0 rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-colors"
            >
              이메일 OTP 로그인
            </button>
          </div>
        ) : activeChild.id.startsWith('local-') ? (
          <div className="rounded-2xl bg-[#F4F1FC] border border-[#E8E4F2] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-bold text-sm text-[#1D192B]">로컬 전용 아이 프로필입니다</p>
              <p className="text-xs text-[#68627A]">
                Google 계정으로 로그인되었습니다. 6자리 초대 코드를 발급해 가족과 공유하려면 먼저 이 아이 프로필을 클라우드에 저장해 주세요.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncLocalChildToCloud}
              className="shrink-0 rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-colors"
            >
              클라우드에 저장하고 공유하기
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Generated 6-digit code display */}
            {generatedCode && (
              <div className="rounded-2xl bg-[#F4F1FC] border border-[#DDD2FB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#6B4CD6]">발급된 6자리 가족 초대 코드 (24시간 유효)</p>
                  <p className="text-2xl font-black font-mono tracking-[0.25em] text-[#1D192B] mt-1">
                    {generatedCode.code}
                  </p>
                  <p className="text-[11px] text-[#68627A] mt-1">
                    가족이 이 코드를 입력하면 아래 승인 대기 목록에 나타나며, 회원님의 확인·승인 후 데이터가 공유됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(generatedCode.code);
                    alert('초대 코드가 복사되었습니다.');
                  }}
                  className="shrink-0 rounded-xl bg-white border border-[#E8E4F2] px-3.5 py-2 text-xs font-bold text-[#6B4CD6] hover:bg-[#F1ECFE]"
                >
                  코드 복사
                </button>
              </div>
            )}

            {/* Owner: Pending approval queue */}
            {activeChild.role === 'owner' && pendingMembers.length > 0 && (
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 space-y-3">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  주 양육자 재확인 · 승인 대기 중인 요청 ({pendingMembers.length}건)
                </p>
                <div className="space-y-2">
                  {pendingMembers.map((pm) => (
                    <div
                      key={pm.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl p-3 border border-amber-200/70"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{pm.user_name || '요청자'}</p>
                        <p className="text-xs text-slate-500">{pm.user_email} · 요청 권한: {pm.role}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApproveMember(pm.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          확인 후 승인
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectMember(pm.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 text-xs font-bold"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Join another child using 6-digit code */}
            <div className="rounded-2xl bg-[#FAFAFD] border border-[#E8E4F2] p-4 space-y-2">
              <p className="text-xs font-bold text-[#1D192B] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#8B6CE8]" />
                다른 가족의 6자리 초대 코드 입력하기
              </p>
              <form onSubmit={handleJoinWithCode} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6자리 숫자 입력"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="flex-1 min-w-[180px] rounded-xl border border-[#E8E4F2] bg-white px-3.5 py-2 text-xs font-mono tracking-widest focus:border-[#8B6CE8] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#8B6CE8] hover:bg-[#7655D9] text-white px-4 py-2 text-xs font-bold"
                >
                  참여 요청
                </button>
              </form>
              {joinStatusMsg && <p className="text-xs font-semibold text-[#6B4CD6]">{joinStatusMsg}</p>}
              {myPendingRequests.length > 0 && (
                <div className="pt-1 space-y-1">
                  {myPendingRequests.map((req) => (
                    <p key={req.member_id} className="text-[11px] text-amber-700 font-medium">
                      • [{req.child_name}] 주 양육자의 확인 및 승인을 기다리는 중입니다.
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {activeChild.members && activeChild.members.length > 0 ? (
            activeChild.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800 font-bold text-sm">
                    {m.user_name ? m.user_name.charAt(0) : '가'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{m.user_name || '초대된 양육자'}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.role === 'owner'
                            ? 'bg-blue-100 text-blue-800'
                            : m.role === 'caregiver'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {m.role === 'owner' ? '소유자 (전체 관리)' : m.role === 'caregiver' ? '양육자 (기록/수정)' : '조회자 (읽기전용)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{m.user_email}</p>
                  </div>
                </div>

                {activeChild.role === 'owner' && m.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="권한 해제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">등록된 구성원이 없습니다.</p>
          )}
        </div>
      </div>

      {/* 3. Privacy & Data Export */}
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-900 text-base mb-2">개인정보 및 데이터 관리</h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          HD²LAB BabyCare는 만 14세 미만 아동의 건강 및 성장 기록을 최고 수준의 접근 제어로 보호합니다. 언제든지 아이의 전체 기록 데이터를 내보내거나 백업할 수 있습니다.
        </p>

        <button
          onClick={handleExportData}
          className="flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          아이 전체 기록 JSON 다운로드 (데이터 내보내기)
        </button>
      </div>

      {/* Invite Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="가족 양육자 초대">
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">초대할 사용자 이메일</label>
            <input
              type="email"
              required
              placeholder="예: spouse@gmail.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">부여할 권한</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInviteRole('caregiver')}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  inviteRole === 'caregiver'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                양육자 (수유/수면 기록 가능)
              </button>
              <button
                type="button"
                onClick={() => setInviteRole('viewer')}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  inviteRole === 'viewer'
                    ? 'bg-slate-200 border-slate-400 text-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                조회자 (읽기 전용)
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              초대 전송
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
