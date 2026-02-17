"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: number;  // plan_id가 아니라 id로 받음
  name: string;
  price: number;
  max_members: number;
  max_storage_mb: number;
  paypal_plan_id?: string | null;
  paypal_product_id?: string | null;
  created_at: string;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    max_members: 5,
    max_storage_mb: 1000,
    currency: "USD",
    interval_unit: "MONTH",
    interval_count: 1,
  });
  const [editFormData, setEditFormData] = useState({
    plan_id: 0,
    name: "",
    price: 0,
    max_members: 5,
    max_storage_mb: 1000,
    paypal_plan_id: "",
    paypal_product_id: "",
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/admin/plans");
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/admin/plans/create-with-paypal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`오류: ${data.error}\n${data.details || ""}`);
        return;
      }

      alert("PayPal 구독 상품이 성공적으로 생성되었습니다!");
      setShowModal(false);
      setFormData({
        name: "",
        description: "",
        price: 0,
        max_members: 5,
        max_storage_mb: 1000,
        currency: "USD",
        interval_unit: "MONTH",
        interval_count: 1,
      });
      fetchPlans();
    } catch (error) {
      console.error("Failed to create plan:", error);
      alert("플랜 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleEditPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);

    try {
      const response = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`오류: ${data.error}`);
        return;
      }

      alert("플랜이 성공적으로 수정되었습니다!");
      setShowEditModal(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (error) {
      console.error("Failed to update plan:", error);
      alert("플랜 수정 중 오류가 발생했습니다.");
    } finally {
      setEditing(false);
    }
  };

  const handleDeletePlan = async (planId: number, planName: string) => {
    if (!confirm(`"${planName}" 플랜을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/plans?plan_id=${planId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`오류: ${data.error}`);
        return;
      }

      alert("플랜이 성공적으로 삭제되었습니다!");
      fetchPlans();
    } catch (error) {
      console.error("Failed to delete plan:", error);
      alert("플랜 삭제 중 오류가 발생했습니다.");
    }
  };

  const openEditModal = (plan: Plan) => {
    setSelectedPlan(plan);
    setEditFormData({
      plan_id: plan.id,  // plan.plan_id가 아니라 plan.id
      name: plan.name,
      price: plan.price,
      max_members: plan.max_members,
      max_storage_mb: plan.max_storage_mb,
      paypal_plan_id: plan.paypal_plan_id || "",
      paypal_product_id: plan.paypal_product_id || "",
    });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            플랜 관리
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            구독 플랜과 PayPal 구독 상품을 관리합니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          + PayPal 구독 상품 생성
        </button>
      </div>

      {/* 플랜 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {plan.name}
              </h3>
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                ${plan.price.toLocaleString()}
                <span className="text-lg text-gray-500 dark:text-gray-400">
                  /월
                </span>
              </div>

              <div className="space-y-3 text-left mt-6">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    최대 {plan.max_members}명
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {(plan.max_storage_mb / 1000).toFixed(1)}GB 저장소
                  </span>
                </div>
                {plan.paypal_plan_id && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-blue-500">🅿️</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        PayPal 연동됨
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 break-all">
                      Plan ID: {plan.paypal_plan_id}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => openEditModal(plan)}
                  className="flex-1 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg transition-colors"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePlan(plan.id, plan.name)}
                  className="flex-1 px-4 py-2 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 통계 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            플랜 상세 정보
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  플랜명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  가격
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  최대 멤버
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  저장소
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  PayPal 연동
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  생성일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {plan.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    ₩{plan.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {plan.max_members}명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {(plan.max_storage_mb / 1000).toFixed(1)}GB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {plan.paypal_plan_id ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                        연동됨
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        미연동
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                PayPal 구독 상품 생성
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                PayPal에 구독 상품을 생성하고 로컬 플랜에도 자동 등록됩니다
              </p>
            </div>

            <form onSubmit={handleCreatePlan} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  플랜명 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="예: Premium Plan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  설명 *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="플랜에 대한 설명을 입력하세요"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    가격 (USD) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    통화
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="KRW">KRW</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    최대 멤버 수 *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.max_members}
                    onChange={(e) => setFormData({ ...formData, max_members: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    저장소 (MB) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={formData.max_storage_mb}
                    onChange={(e) => setFormData({ ...formData, max_storage_mb: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    청구 주기
                  </label>
                  <select
                    value={formData.interval_unit}
                    onChange={(e) => setFormData({ ...formData, interval_unit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="DAY">일</option>
                    <option value="WEEK">주</option>
                    <option value="MONTH">월</option>
                    <option value="YEAR">년</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    주기 수
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.interval_count}
                    onChange={(e) => setFormData({ ...formData, interval_count: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                >
                  {creating ? "생성 중..." : "PayPal 구독 상품 생성"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                플랜 수정
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                플랜 정보를 수정합니다
              </p>
            </div>

            <form onSubmit={handleEditPlan} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  플랜명 *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  가격 (USD) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={editFormData.price}
                  onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    최대 멤버 수 *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editFormData.max_members}
                    onChange={(e) => setEditFormData({ ...editFormData, max_members: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    저장소 (MB) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={editFormData.max_storage_mb}
                    onChange={(e) => setEditFormData({ ...editFormData, max_storage_mb: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {selectedPlan.paypal_plan_id && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                    <strong>PayPal 연동 정보</strong>
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 break-all">
                    Product ID: {selectedPlan.paypal_product_id}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 break-all">
                    Plan ID: {selectedPlan.paypal_plan_id}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPlan(null);
                  }}
                  disabled={editing}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                >
                  {editing ? "수정 중..." : "플랜 수정"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
