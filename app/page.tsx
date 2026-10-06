import Nav from "@/components/Nav";
import AskClaude from "@/components/AskClaude";
import { MotionRoot } from "@/components/Motion";
import { FinalBusiness, FlowLab, Home, Investing, Learn, Market, Quality, RedTeam } from "@/components/Static";
import Opportunities from "@/components/Opportunities";
import Portfolio from "@/components/Portfolio";
import Swing from "@/components/Swing";
import Quant from "@/components/Quant";
import StrategyLab from "@/components/StrategyLab";
import Catalysts from "@/components/Catalysts";
import Business from "@/components/Business";
import Formulas from "@/components/Formulas";

export default function Page() {
  return (
    <>
      <a href="#market" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:text-cream focus:px-3 focus:py-2 focus:rounded">Skip to content</a>
      <MotionRoot />
      <Nav />
      <main>
        <Home />
        <Market />
        <Investing />
        <Opportunities />
        <Portfolio />
        <Swing />
        <Quant />
        <StrategyLab />
        <Learn />
        <Catalysts />
        <Business />
        <FinalBusiness />
        <RedTeam />
        <Formulas />
        <FlowLab />
        <Quality />
      </main>
      <AskClaude />
    </>
  );
}
