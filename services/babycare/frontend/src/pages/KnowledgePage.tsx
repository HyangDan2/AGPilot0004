import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ContentArticle } from '../types';
import { Search, BookOpen, ExternalLink, ShieldCheck, Filter, ChevronRight } from 'lucide-react';
import { Modal } from '../components/common/Modal';

const CATEGORIES = [
  { id: 'all', label: '전체 카테고리' },
  { id: 'Newborn Care', label: '신생아 케어' },
  { id: 'Feeding', label: '수유 가이드' },
  { id: 'Sleep', label: '수면 안전' },
  { id: 'Development', label: '발달 마일스톤' },
  { id: 'Health', label: '건강 · 발열' },
  { id: 'Safety', label: '안전 · 응급처치' },
  { id: 'Weaning', label: '이유식' },
  { id: 'Parenting Tips', label: '양육 팁' },
];

export const KnowledgePage: React.FC = () => {
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<ContentArticle | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadArticles();
  }, [selectedCategory, selectedAge]);

  const loadArticles = async () => {
    setIsLoading(true);
    try {
      const ageVal = selectedAge === 'all' ? undefined : Number(selectedAge);
      const data = await api.getArticles(selectedCategory, ageVal, keyword || undefined);
      setArticles(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadArticles();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">월령별 육아 정보 도서관</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-800 px-2.5 py-0.5 text-xs font-bold border border-blue-200/60">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            공식 보건당국 검수 완료
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          질병관리청(KDCA), 보건복지부, 대한소아청소년과학회의 공인 표준 가이드라인을 제공합니다.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="황달, 수면, 이유식, 발열 등 키워드를 검색하세요..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none shadow-sm"
          />
        </form>

        <select
          value={selectedAge}
          onChange={(e) => setSelectedAge(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:outline-none shadow-sm"
        >
          <option value="all">전체 월령</option>
          <option value="0">생후 0~1개월 (신생아)</option>
          <option value="3">생후 2~5개월</option>
          <option value="6">생후 6~11개월 (이유식기)</option>
          <option value="12">생후 12~24개월 (돌 이후)</option>
          <option value="36">생후 24개월 이상</option>
        </select>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-slate-400 text-sm bg-white rounded-3xl border border-slate-100">
            검색 조건에 맞는 육아 정보가 없습니다.
          </div>
        ) : (
          articles.map((art) => (
            <div
              key={art.id}
              onClick={() => setActiveArticle(art)}
              className="cursor-pointer rounded-3xl bg-white p-6 shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded-full bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5">
                    {art.category}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    권장 월령: {art.age_months_min}~{art.age_months_max}개월
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {art.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                  {art.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px] truncate max-w-[200px]">
                  출처: {art.source?.organization || '질병관리청'}
                </span>
                <span className="text-blue-600 font-bold flex items-center gap-0.5">
                  전문 보기
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Article Detail Modal */}
      <Modal
        isOpen={!!activeArticle}
        onClose={() => setActiveArticle(null)}
        title={activeArticle?.title || '육아 정보'}
        maxWidth="max-w-2xl"
      >
        {activeArticle && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <span className="rounded-full bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1">
                카테고리: {activeArticle.category}
              </span>
              <span className="text-xs text-slate-500">
                권장 대상: 생후 {activeArticle.age_months_min}개월 ~ {activeArticle.age_months_max}개월
              </span>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/60 text-xs text-slate-700 font-medium leading-relaxed">
              💡 <strong>핵심 요약:</strong> {activeArticle.summary}
            </div>

            <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-line leading-relaxed text-sm pt-2">
              {activeArticle.content_body}
            </div>

            {/* Official Source & License Citation Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/70 p-3.5 rounded-2xl text-xs space-y-1 text-slate-500">
              <p className="font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                공식 출처 및 라이선스 정보
              </p>
              <p>기관명: {activeArticle.source?.organization}</p>
              <p>라이선스: {activeArticle.source?.license}</p>
              {activeArticle.source?.url && (
                <a
                  href={activeArticle.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline mt-1"
                >
                  출처 웹사이트 방문
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
