Zethr Issue Tracker
================

If you find an issue, please report it on the "Issues" tab above.

Below you can find info about the contracts, but this github will mainly be used as the public issue tracker for Zethr.

--
--
--
--
--
--

# Zethr Contract Info

Here you can find the Zethr contracts, along with the suite of Truffle tests we use to catch bugs as we develop.

## Truffle Tests

You can view our truffle test setup in the /truffle folder. There, you can see all of the 50+ tests we have for Zethr and its subsystems. Feel free to run them on your own!

## Zethr Main Contract

This is the main Zethr contract, and probably the most prone to bugs. When created, it should not allow any buys or sells. Once the devs (administrators) launch the ICO phase, buys should be allowed, but not sells. Buys are restricted by a password provided by the admins on the main Zethr website (https://zethr.io), but only during the ICO phase.

The regular phase should be triggerable by the administrators, or anyone 2 weeks after the ICO phase has begun.

Once the regular phase begins, buys AND sells should be allowed, with the price increasing in value as more tokens are bought, and decreasing in value as more tokens are sold. Token price should never go below the ICO price.

When buying tokens, people should be restricted to only the dividend rates specified in the contract - 2, 5, 10, 15, 20, 25, and 33%. When selling tokens, the dividend rate applied should be the average of all the user's buyins.

When buying tokens during the ICO phase, all dividends should go to the Bankroll (which then buys tokens). When buying tokens NOT during the ICO phase, 1% of all buys should go to the two div-card holders (0.5% each), and 25% of dividends should go to referrers (if they have enough tokens for a masternode).

When transferring tokens, there should be no exploits, and the recipient of the transfer should inherit the average dividend rate of the sender if they have no tokens. We can use the transferTo function to transfer tokens to a contract, which *must* have a token receiving fallback function to then call a function using these tokens - this will be used for games. See: ZethHell and ZethRoll.

## Zethr Div Cards

Each dividend card should be purchaseable, but not by the person who currently owns it. Smart contracts should be prevented from buying dividend cards. Dividend cards, when purchased, should go up in price according to their represtend dividend percentage - for example, the 10% dividend card should go up in value by 10% each time.

When dividend cards are bought, half of the profit should go to the bankroll, and have of the profit should go to the previous owner.

Dividend cards should receive 0.5% of every buy value in the main Zethr contract during the regular phase, but nothing during the ICO phase.

Dividend cards should only be activated when an administrator start them.

## ZethHell

Penny-auction style game.

## ZethRoll

Dice game, akin to Etheroll.

## Zethr Bankroll

The bankroll is the standard multisig contract with some additions. In addition to ordinary multisig, it should allow whitelisting of contracts that can pull ETH from it. The bankroll is mostly a stub, as we will be adding functionality to it - most important is that we should be able to change the bankroll address for Zethr.

