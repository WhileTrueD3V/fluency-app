import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { Colors } from '@/constants/colors';
import { XIcon } from '@/components/Icons';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Privacy</Text>
            <Text style={styles.title}>Privacy policy</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close privacy policy">
            <XIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PolicyBlock
            title="Local-first preview"
            body="This preview build stores practice progress, saved Library items, settings, and credit usage counters on your device. The app does not include accounts or third-party tracking in this build."
          />
          <PolicyBlock
            title="Speech and AI feedback"
            body={`Speaking, conversation, and text-chat practice may send the prompt, your response transcript, and local rubric scores to ${Brand.name}'s grading server when AI feedback is enabled. API keys stay on the server and are not shipped in the app.`}
          />
          <PolicyBlock
            title="Product feedback"
            body={`If you submit the optional first-drill feedback prompt, ${Brand.name} sends the rating, comment, and first drill type to the configured server so the team can review app-quality signals beyond local storage.`}
          />
          <PolicyBlock
            title="Subscriptions"
            body="Subscription status is currently stored locally for preview. Before public release, iOS subscriptions must be handled through Apple In-App Purchase and receipt validation."
          />
          <PolicyBlock
            title="AP disclaimer"
            body={Brand.collegeBoardDisclaimer}
          />
          <PolicyBlock
            title="Children and students"
            body={`Before public launch, ${Brand.name} needs a final legal privacy policy that explains student data handling, support contact information, and any age-related requirements for the launch market.`}
          />
          <PolicyBlock
            title="Contact"
            body="Support and privacy contact details must be added before App Store submission."
          />
        </ScrollView>
      </View>
    </View>
  );
}

function PolicyBlock({ title, body }: { title: string; body: string }) {
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
