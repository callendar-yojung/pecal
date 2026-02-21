import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TextInput, ScrollView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useApp, genId } from '@/lib/app-context';
import { useColors } from '@/hooks/use-colors';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { WorkspacePlan } from '@/lib/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function TeamCreateModal({ visible, onClose }: Props) {
  const { dispatch } = useApp();
  const colors = useColors();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState<WorkspacePlan>('free');

  const handleClose = () => {
    setStep(1);
    setName('');
    setDescription('');
    setPlan('free');
    onClose();
  };

  const handleNext = () => {
    if (!name.trim()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
  };

  const handleCreate = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newWs = {
      id: genId('ws'),
      name: name.trim(),
      description: description.trim() || undefined,
      type: 'team' as const,
      plan,
      memberCount: 1,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_WORKSPACE', payload: newWs });
    dispatch({ type: 'SET_WORKSPACE', payload: newWs.id });
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {step === 1 ? '팀 만들기' : '플랜 선택'}
            </Text>
            <Pressable onPress={handleClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </Pressable>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]} />
            <View style={[styles.stepLine, { backgroundColor: step === 2 ? colors.primary : colors.border }]} />
            <View style={[styles.stepDot, { backgroundColor: step === 2 ? colors.primary : colors.border }]} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {step === 1 ? (
              <View style={styles.form}>
                <Text style={[styles.label, { color: colors.muted }]}>팀 이름 *</Text>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.foreground,
                  }]}
                  placeholder="팀 이름을 입력하세요"
                  placeholderTextColor={colors.muted}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="next"
                  autoFocus
                />

                <Text style={[styles.label, { color: colors.muted }]}>설명 (선택)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.foreground,
                  }]}
                  placeholder="팀에 대한 간단한 설명을 입력하세요"
                  placeholderTextColor={colors.muted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.nextBtn,
                    { backgroundColor: name.trim() ? colors.primary : colors.border },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleNext}
                  disabled={!name.trim()}
                >
                  <Text style={[styles.nextBtnText, { color: name.trim() ? '#fff' : colors.muted }]}>
                    다음
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={[styles.planSubtitle, { color: colors.muted }]}>
                  팀에 적합한 플랜을 선택하세요
                </Text>

                {/* Free Plan */}
                <Pressable
                  style={({ pressed }) => [
                    styles.planCard,
                    {
                      backgroundColor: plan === 'free' ? colors.surface2 : colors.surface,
                      borderColor: plan === 'free' ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setPlan('free')}
                >
                  <View style={styles.planHeader}>
                    <View>
                      <Text style={[styles.planName, { color: colors.foreground }]}>무료 플랜</Text>
                      <Text style={[styles.planPrice, { color: colors.muted }]}>₩0 / 월</Text>
                    </View>
                    <View style={[
                      styles.planRadio,
                      { borderColor: plan === 'free' ? colors.primary : colors.border },
                    ]}>
                      {plan === 'free' && <View style={[styles.planRadioInner, { backgroundColor: colors.primary }]} />}
                    </View>
                  </View>
                  <View style={styles.planFeatures}>
                    {['최대 3명', '일정·메모·파일 관리', '기본 알림'].map(f => (
                      <View key={f} style={styles.planFeatureRow}>
                        <IconSymbol name="checkmark" size={14} color={colors.success} />
                        <Text style={[styles.planFeatureText, { color: colors.foreground }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>

                {/* Pro Plan */}
                <Pressable
                  style={({ pressed }) => [
                    styles.planCard,
                    {
                      backgroundColor: plan === 'pro' ? colors.surface2 : colors.surface,
                      borderColor: plan === 'pro' ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setPlan('pro')}
                >
                  <View style={styles.planBadge}>
                    <IconSymbol name="crown.fill" size={12} color="#fff" />
                    <Text style={styles.planBadgeText}>PRO</Text>
                  </View>
                  <View style={styles.planHeader}>
                    <View>
                      <Text style={[styles.planName, { color: colors.foreground }]}>프로 플랜</Text>
                      <Text style={[styles.planPrice, { color: colors.muted }]}>₩9,900 / 월</Text>
                    </View>
                    <View style={[
                      styles.planRadio,
                      { borderColor: plan === 'pro' ? colors.primary : colors.border },
                    ]}>
                      {plan === 'pro' && <View style={[styles.planRadioInner, { backgroundColor: colors.primary }]} />}
                    </View>
                  </View>
                  <View style={styles.planFeatures}>
                    {['무제한 멤버', '무제한 파일 저장', '고급 알림 & 자동화', '우선 지원'].map(f => (
                      <View key={f} style={styles.planFeatureRow}>
                        <IconSymbol name="checkmark" size={14} color={colors.primary} />
                        <Text style={[styles.planFeatureText, { color: colors.foreground }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </Pressable>

                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [styles.backBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                    onPress={() => setStep(1)}
                  >
                    <Text style={[styles.backBtnText, { color: colors.foreground }]}>이전</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
                    onPress={handleCreate}
                  >
                    <Text style={styles.createBtnText}>팀 만들기</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 0,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  content: {
    paddingHorizontal: 20,
  },
  form: {
    gap: 12,
    paddingBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  nextBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  planSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  planBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#5B6CF6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 13,
    marginTop: 2,
  },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planFeatures: {
    gap: 6,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
