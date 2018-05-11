Zethr Bug Bounty
================

Feel like earning some ETH? We've set aside 5 ETH for the Zethr Platform bug bounty.
We'll get straight to the point: below, we have a description of all of our contracts and their intended purposes. If you manage to find bugs in them, here's what you can earn:

1) 0.5 ETH - CRITICAL: This bug enables stealing of ETH or complete lockdown of the contract / blackholing eth. No bueno.

2) 0.1 ETH - MEDIUM: This bug makes the contract function in an unintended way, or otherwise opens up loopholes that can be exploited, but not to the severity of CRITICAL bugs.

3) 0.025 ETH - NITPICKS: These are "bugs" in that we should probably fix them, but they won't hurt the project too much if we don't. Example: Earlier, in Zethr.sol, we were able to add and remove arbitrary div rates, which we could have used to lock up the project as pointed out by a community member. This isn't great, but it's not MEDIUM or CRITICAL.

Please report these bugs by creating issues. We reserve the right to judge the severity category of the bug. Please post your address in your issue to receive ETH.

## Zethr Main Contract

This is the main Zethr contract, and probably the most prone to bugs. When created, it should not allow any buys or sells. Once the devs (administrators) launch the ICO phase, buys should be allowed, but not sells. Buys are restricted by a password provided by the admins on the main Zethr website (https://zethr.io), but only during the ICO phase.

The regular phase should be triggerable by the administrators, or anyone 2 weeks after the ICO phase has begun.

Once the regular phase begins, buys AND sells should be allowed, with the price increasing in value as more tokens are bought, and decreasing in value as more tokens are sold. Token price should never go below the ICO price.

When buying tokens, people should be restricted to only the dividend rates specified in the contract - 2, 5, 10, 15, 20, 25, and 33%. When selling tokens, the dividend rate applied should be the average of all the user's buyins.

When buying tokens during the ICO phase, all dividends should go to the Bankroll (which then buys tokens). When buying tokens NOT during the ICO phase, 1% of all buys should go to the two div-card holders (0.5% each), and 25% of dividends should go to referrers (if they have enough tokens for a masternode).

When transferring tokens, there should be no exploits, and the recipient of the transfer should inherit the average dividend rate of the sender if they have no tokens.

## Zethr Div Cards

Each dividend card should be purchaseable, but not by the person who currently owns it. Smart contracts should be prevented from buying dividend cards. Dividend cards, when purchased, should go up in price according to their represtend dividend percentage - for example, the 10% dividend card should go up in value by 10% each time.

When dividend cards are bought, half of the profit should go to the bankroll, and have of the profit should go to the previous owner.

Dividend cards should receive 0.5% of every buy value in the main Zethr contract during the regular phase, but nothing during the ICO phase.

Dividend cards should only be activated when an administrator start them.

## Zethr Bankroll

The bankroll is the standard multisig contract with some additions. In addition to rodinary multisig, it should allow whitelisting of contracts that can pull ETH from it. The bankroll is mostly a stub, as we will be adding functionality to it - most important is that we should be able to change the bankroll address for Zethr.

