import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useI18n } from '../../src/contexts/I18nContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { apiFetch, getApiBaseUrl } from '../../src/lib/api';
import { type WorkspaceUsageData } from '../../src/lib/plan-limits';
import { createStyles } from '../../src/styles/createStyles';
import type { TeamItem, Workspace } from '../../src/lib/types';

type OwnerType = 'personal' | 'team';
type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trialing';

type Plan = {
  id: number;
  name: string;
  price: number;
  max_members: number;
  max_storage_mb: number;
  plan_type?: OwnerType;
};

type Subscription = {
  id?: number;
  subscription_id?: number;
  owner_id?: number;
  owner_type?: OwnerType;
  plan_id?: number;
  status: SubscriptionStatus;
  started_at?: string;
  next_payment_date?: string | null;
  expires_at?: string | null;
  plan_name?: string;
  plan_price?: number;
};

type SavedCard = {
  id: number;
  cardCode?: string;
  cardName?: string;
  cardNoMasked?: string;
  createdAt?: string;
};

type PaymentRecord = {
  payment_id: number;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED';
  payment_type: 'FIRST' | 'RECURRING' | 'RETRY';
  plan_name?: string;
  tid?: string | null;
  created_at: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(date?: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

function formatAmount(amount: number) {
  return `₩${amount.toLocaleString()}`;
}

function getBarColor(ratio: number) {
  if (ratio >= 0.9) return '#EF4444';
  if (ratio >= 0.7) return '#F59E0B';
  return '#10B981';
}

function getStatusLabel(status: SubscriptionStatus | null, isKo: boolean) {
  switch (status) {
    case 'active':
      return isKo ? '이용 중' : 'Active';
    case 'trialing':
      return isKo ? '체험 중' : 'Trialing';
    case 'canceled':
      return isKo ? '해지 예정' : 'Canceled';
    case 'expired':
      return isKo ? '만료됨' : 'Expired';
    default:
      return isKo ? '무료 플랜' : 'Free Plan';
  }
}

function getStatusStyle(status: SubscriptionStatus | null) {
  switch (status) {
    case 'active':
      return { backgroundColor: '#DCFCE7', color: '#15803D' };
    case 'trialing':
      return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
    case 'canceled':
      return { backgroundColor: '#FEF3C7', color: '#B45309' };
    case 'expired':
      return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
    default:
      return { backgroundColor: '#E5E7EB', color: '#4B5563' };
  }
}

function UsageBar({
  label,
  used,
  limit,
  detail,
  formatter,
  colors,
}: {
  label: string;
  used: number;
  limit: number;
  detail?: string;
  formatter?: (value: number) => string;
  colors: { text: string; textMuted: string; border: string };
}) {
  const ratio = limit > 0 ? used / limit : 0;
  const format = formatter ?? ((value: number) => String(value));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 }}>{label}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
          {format(used)} / {format(limit)}
          {detail ? ` (${detail})` : ''}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.min(Math.max(ratio * 100, 0), 100)}%`,
            height: '100%',
            backgroundColor: getBarColor(ratio),
          }}
        />
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  sub,
  colors,
}: {
  label: string;
  value: number;
  sub?: string;
  colors: { cardSoft: string; text: string; textMuted: string };
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.cardSoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, gap: 2 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      {sub ? <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

function resolveTeamWorkspace(teamId: number | null, teamWorkspaces: Workspace[]) {
  if (!teamId) return null;
  return teamWorkspaces.find((workspace) => workspace.owner_id === teamId) ?? null;
}

export default function SettingsPlanPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const { auth, data } = useMobileApp();
  const isKo = locale === 'ko';

  const [ownerType, setOwnerType] = useState<OwnerType>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [usage, setUsage] = useState<WorkspaceUsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [removingCard, setRemovingCard] = useState(false);

  useEffect(() => {
    if (data.teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(data.teams[0].id);
    }
  }, [data.teams, selectedTeamId]);

  useEffect(() => {
    if (data.selectedWorkspace?.type === 'team' && data.selectedWorkspace.owner_id) {
      setOwnerType('team');
      setSelectedTeamId((prev) => prev ?? data.selectedWorkspace?.owner_id ?? null);
    }
  }, [data.selectedWorkspace]);

  const personalWorkspace = data.workspaces[0] ?? null;
  const selectedTeamWorkspace = useMemo(
    () => resolveTeamWorkspace(selectedTeamId, data.teamWorkspaces),
    [selectedTeamId, data.teamWorkspaces]
  );

  const activeWorkspace = ownerType === 'personal' ? personalWorkspace : selectedTeamWorkspace;
  const ownerId =
    ownerType === 'personal'
      ? auth.session?.memberId ?? null
      : selectedTeamId;

  const visiblePlans = useMemo(() => {
    if (ownerType === 'team') {
      return plans.filter((plan) => plan.plan_type === 'team' || /team|enterprise/i.test(plan.name));
    }
    return plans.filter((plan) => plan.plan_type !== 'team' && !/team|enterprise/i.test(plan.name));
  }, [ownerType, plans]);

  const isPaidSubscription = Boolean(subscription && (subscription.id || subscription.subscription_id));
  const baseUrl = getApiBaseUrl();

  useEffect(() => {
    if (!auth.session || !activeWorkspace?.workspace_id) return;
    const run = async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        const [plansRes, usageRes, subscriptionRes, billingRes, paymentsRes] = await Promise.all([
          apiFetch<Plan[]>('/api/plans', auth.session),
          apiFetch<WorkspaceUsageData>(`/api/me/usage?workspace_id=${activeWorkspace.workspace_id}`, auth.session),
          ownerId
            ? apiFetch<Subscription | null>(
                `/api/subscriptions?owner_id=${ownerId}&owner_type=${ownerType}&active=true`,
                auth.session
              )
            : Promise.resolve(null),
          apiFetch<{ billingKey?: SavedCard }>('/api/nicepay/billing/register', auth.session).catch(() => ({ billingKey: null })),
          ownerId
            ? apiFetch<{ payments: PaymentRecord[] }>(
                `/api/payments?owner_id=${ownerId}&owner_type=${ownerType}`,
                auth.session
              ).catch(() => ({ payments: [] }))
            : Promise.resolve({ payments: [] as PaymentRecord[] }),
        ]);

        setPlans(Array.isArray(plansRes) ? plansRes : []);
        setUsage(usageRes);
        setSubscription(subscriptionRes ?? null);
        setSavedCard(billingRes.billingKey ?? null);
        setPayments(paymentsRes.payments ?? []);
      } catch (loadError) {
        console.error('Failed to load mobile plan settings:', loadError);
        setError(isKo ? '플랜 정보를 불러오지 못했습니다.' : 'Failed to load plan details.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [activeWorkspace?.workspace_id, auth.session, isKo, ownerId, ownerType]);

  const openExternal = async (url: string) => {
    await Linking.openURL(url);
  };

  const openPlansPage = async () => {
    if (!ownerId) return;
    await openExternal(`${baseUrl}/dashboard/settings/billing/plans/${ownerType}?owner_id=${ownerId}`);
  };

  const openCheckoutForPlan = async (planId: number) => {
    if (!ownerId) return;
    await openExternal(
      `${baseUrl}/dashboard/settings/billing/checkout?plan_id=${planId}&owner_type=${ownerType}&owner_id=${ownerId}`
    );
  };

  const handleCancelSubscription = async () => {
    const subscriptionId = subscription?.id ?? subscription?.subscription_id;
    if (!auth.session || !subscriptionId || canceling) return;
    setCanceling(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch<{ success: boolean }>('/api/subscriptions', auth.session, {
        method: 'PUT',
        body: JSON.stringify({ id: subscriptionId, status: 'CANCELED' }),
      });
      setSubscription((current) => (current ? { ...current, status: 'canceled' } : current));
      setSuccess(isKo ? '구독이 해지되었습니다.' : 'Subscription canceled.');
    } catch (cancelError) {
      console.error('Failed to cancel subscription:', cancelError);
      setError(isKo ? '구독 해지에 실패했습니다.' : 'Failed to cancel subscription.');
    } finally {
      setCanceling(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!auth.session || removingCard || isPaidSubscription) return;
    setRemovingCard(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch<{ success: boolean }>('/api/nicepay/billing/remove', auth.session, {
        method: 'DELETE',
      });
      setSavedCard(null);
      setSuccess(isKo ? '저장된 카드가 제거되었습니다.' : 'Saved card removed.');
    } catch (removeError) {
      console.error('Failed to remove billing key:', removeError);
      setError(isKo ? '카드 제거에 실패했습니다.' : 'Failed to remove saved card.');
    } finally {
      setRemovingCard(false);
    }
  };

  const statusStyle = getStatusStyle(subscription?.status ?? null);
  const planName = subscription?.plan_name || usage?.plan.plan_name || (isKo ? '기본 플랜' : 'Basic Plan');

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={s.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
              {isKo ? '설정' : 'Settings'}
            </Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            {isKo ? '플랜' : 'Plan'}
          </Text>
          <View style={{ width: 58 }} />
        </View>

        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>
          {isKo ? '플랜' : 'Plan'}
        </Text>

        <View style={[s.panel, { borderRadius: 13, gap: 12 }]}>
          <Text style={s.formTitle}>{isKo ? '대상' : 'Scope'}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[s.secondaryButtonHalf, ownerType === 'personal' ? { borderColor: colors.primary, borderWidth: 1.5 } : null]}
              onPress={() => setOwnerType('personal')}
            >
              <Text style={s.secondaryButtonText}>{isKo ? '개인' : 'Personal'}</Text>
            </Pressable>
            <Pressable
              style={[s.secondaryButtonHalf, ownerType === 'team' ? { borderColor: colors.primary, borderWidth: 1.5 } : null]}
              onPress={() => setOwnerType('team')}
            >
              <Text style={s.secondaryButtonText}>{isKo ? '팀' : 'Team'}</Text>
            </Pressable>
          </View>

          {ownerType === 'team' ? (
            <View style={{ gap: 8 }}>
              {data.teams.length === 0 ? (
                <Text style={s.itemMeta}>{isKo ? '연결된 팀이 없습니다.' : 'No linked teams.'}</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {data.teams.map((team: TeamItem) => {
                    const active = selectedTeamId === team.id;
                    return (
                      <Pressable
                        key={team.id}
                        onPress={() => setSelectedTeamId(team.id)}
                        style={[
                          s.secondaryButtonHalf,
                          {
                            flexBasis: '48%',
                            flexGrow: 0,
                            flexShrink: 0,
                            borderColor: active ? colors.primary : colors.border,
                            borderWidth: active ? 1.5 : 1,
                          },
                        ]}
                      >
                        <Text style={s.secondaryButtonText} numberOfLines={1}>
                          {team.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          <Text style={s.itemMeta}>
            {activeWorkspace
              ? `${isKo ? '현재 워크스페이스' : 'Current workspace'}: ${activeWorkspace.name}`
              : isKo
                ? '선택 가능한 워크스페이스가 없습니다.'
                : 'No workspace available.'}
          </Text>
        </View>

        {error ? (
          <View style={[s.panel, { borderRadius: 13, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
            <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '700' }}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={[s.panel, { borderRadius: 13, borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
            <Text style={{ color: '#15803D', fontSize: 13, fontWeight: '700' }}>{success}</Text>
          </View>
        ) : null}

        <View style={[s.panel, { borderRadius: 13, gap: 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                {isKo ? '현재 플랜' : 'Current plan'}
              </Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{planName}</Text>
              <Text style={s.itemMeta}>{usage?.workspace_name || activeWorkspace?.name || '-'}</Text>
            </View>
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: statusStyle.backgroundColor }}>
              <Text style={{ color: statusStyle.color, fontSize: 11, fontWeight: '700' }}>
                {getStatusLabel(subscription?.status ?? null, isKo)}
              </Text>
            </View>
          </View>

          {subscription?.next_payment_date || subscription?.expires_at ? (
            <Text style={s.itemMeta}>
              {isKo ? '다음 결제/만료' : 'Next billing / expiry'}:{' '}
              {formatDate(subscription?.next_payment_date || subscription?.expires_at)}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={s.secondaryButtonHalf} onPress={() => void openPlansPage()} disabled={!ownerId}>
              <Text style={s.secondaryButtonText}>{isKo ? '플랜 페이지 열기' : 'Open plans'}</Text>
            </Pressable>
            {subscription ? (
              <Pressable
                style={[
                  s.secondaryButtonHalf,
                  { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
                ]}
                onPress={() => void handleCancelSubscription()}
                disabled={canceling}
              >
                <Text style={[s.secondaryButtonText, { color: '#DC2626' }]}>
                  {canceling ? (isKo ? '해지 중...' : 'Canceling...') : (isKo ? '구독 해지' : 'Cancel subscription')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[s.panel, { borderRadius: 13, gap: 12 }]}>
          <Text style={s.formTitle}>{isKo ? '사용량' : 'Usage'}</Text>
          {loading ? (
            <Text style={s.itemMeta}>{isKo ? '불러오는 중...' : 'Loading...'}</Text>
          ) : usage ? (
            <>
              <UsageBar
                label={isKo ? '저장소' : 'Storage'}
                used={usage.storage.used_bytes}
                limit={usage.storage.limit_bytes}
                detail={isKo ? `파일 ${usage.storage.file_count}개` : `${usage.storage.file_count} files`}
                formatter={formatBytes}
                colors={colors}
              />
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: colors.cardSoft,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {isKo ? '최대 파일 크기' : 'Max file size'}
                </Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                  {formatBytes(usage.plan.max_file_size_bytes)}
                </Text>
                <Text style={s.itemMeta}>
                  {isKo
                    ? '모바일도 같은 플랜 제한을 적용합니다.'
                    : 'Mobile follows the same plan-based upload limit.'}
                </Text>
              </View>
              {ownerType === 'team' ? (
                <UsageBar
                  label={isKo ? '팀 멤버' : 'Members'}
                  used={usage.members.current}
                  limit={usage.members.max}
                  colors={colors}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <StatCard label={isKo ? '전체 일정' : 'Total tasks'} value={usage.tasks.total} colors={colors} />
                <StatCard label={isKo ? '이번 달 생성' : 'Created'} value={usage.tasks.created_this_month} colors={colors} />
                <StatCard label={isKo ? '이번 달 완료' : 'Completed'} value={usage.tasks.completed_this_month} colors={colors} />
              </View>
            </>
          ) : (
            <Text style={s.itemMeta}>{isKo ? '사용량 정보를 불러오지 못했습니다.' : 'Usage data unavailable.'}</Text>
          )}
        </View>

        <View style={[s.panel, { borderRadius: 13, gap: 12 }]}>
          <Text style={s.formTitle}>{isKo ? '결제 수단' : 'Payment method'}</Text>
          {savedCard ? (
            <>
              <Text style={s.itemMeta}>
                {(savedCard.cardName || (isKo ? '저장된 카드' : 'Saved card'))}
                {savedCard.cardNoMasked ? ` · ${savedCard.cardNoMasked}` : ''}
              </Text>
              <Pressable
                style={[s.secondaryButtonHalf, { width: '100%' }]}
                onPress={() => void handleRemoveCard()}
                disabled={removingCard || isPaidSubscription}
              >
                <Text style={s.secondaryButtonText}>
                  {removingCard
                    ? isKo
                      ? '제거 중...'
                      : 'Removing...'
                    : isPaidSubscription
                      ? isKo
                        ? '유료 구독 해지 후 제거 가능'
                        : 'Cancel paid subscription first'
                      : isKo
                        ? '카드 제거'
                        : 'Remove card'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={s.itemMeta}>{isKo ? '저장된 카드가 없습니다.' : 'No saved card.'}</Text>
          )}
        </View>

        <View style={[s.panel, { borderRadius: 13, gap: 12 }]}>
          <Text style={s.formTitle}>{isKo ? '결제 내역' : 'Payment history'}</Text>
          {payments.length === 0 ? (
            <Text style={s.itemMeta}>{isKo ? '결제 내역이 없습니다.' : 'No payment history.'}</Text>
          ) : (
            payments.slice(0, 8).map((payment) => (
              <View key={payment.payment_id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
                    {payment.plan_name || (isKo ? '플랜 결제' : 'Plan payment')}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                    {formatAmount(payment.amount)}
                  </Text>
                </View>
                <Text style={s.itemMeta}>
                  {payment.status} · {formatDate(payment.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
