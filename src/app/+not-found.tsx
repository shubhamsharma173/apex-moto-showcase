import React from "react";
import { router } from "expo-router";
import { Page } from "../components/Shell";
import { Empty } from "../components/ui";
export default function NotFound() {
  return (
    <Page>
      <Empty
        icon="compass-outline"
        title="A little off the route."
        body="This page doesn’t exist. Let’s get you back to your open road."
        action="Back to overview"
        onPress={() => router.replace("/")}
      />
    </Page>
  );
}
