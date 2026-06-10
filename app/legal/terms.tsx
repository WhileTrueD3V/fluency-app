import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { Colors } from '@/constants/colors';
import { XIcon } from '@/components/Icons';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Terms</Text>
            <Text style={styles.title}>Terms of use</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close terms">
            <XIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TermsBlock
            title="Educational practice"
            body={`${Brand.name} is an AP language practice tool. AI feedback and local rubric estimates are study aids, not official AP scores or guarantees of exam results.`}
          />
          <TermsBlock
            title="AI feedback"
            body="AI reviews can be helpful but imperfect. Learners should treat feedback as coaching and verify important grammar, cultural, or exam guidance with a teacher or trusted source."
          />
          <TermsBlock
            title="Subscriptions"
            body="The preview subscription system is not final billing. Before public release, iOS plans must use Apple In-App Purchase, include restore purchases, and clearly explain renewal and cancellation."
          />
          <TermsBlock
            title="AP trademark clarity"
            body={Brand.collegeBoardDisclaimer}
          />
          <TermsBlock
            title="Final legal review"
            body="These preview terms are not a substitute for final legal terms. A launch-ready version needs owner contact details, jurisdiction, refund policy references, and support information."
          />
        </ScrollView>
      </View>
    </View>
  );
}

function TermsBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 34,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 20,
  },
  kicker: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 6,
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  content: {
    gap: 14,
    paddingBottom: 40,
  },
  block: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 18,
    gap: 8,
  },
  blockTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  blockBody: {
    color: Colors.textSub,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
  },
});
