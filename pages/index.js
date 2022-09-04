import {Contract, providers, utils} from "ethers";
import { getJsonWalletAddress } from "ethers/lib/utils";
import Head from "next/head";
import React, {useEffect, useRef, useState} from "react";
import Web3Modal from "web3modal";
import { abi, NFT_CONTRACT_ADDRESS} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home()
{
  //walletConnected keep track of wether the user's wallet is connected or not
  const [walletConnected, setWalletConnected] = useState(false);
  //presaleStarted keeps track of wether the presale has started or not
  const [presaleStarted, setPresaleStarted] = useState(false);
  //presaleEnded keeps track of wether the presale ended
  const [presaleEnded, setPresaleEnded] = useState(false);
  //loading is set to true when we are waiting for a transaction to get mined
  const [loading, setLoading] = useState(false);
  //isOwner checks if the currently connected MetaMask wallet is the owner of the contract
  const [isOwner, setIsOwner] = useState(false);
  // tokenIdsMinted keeps track of the number of tokenIds that have been minted
  const [tokenIdsMinted, setTokenIdsMinted] = useState("0");
  //Create a reference to the Web3 Modal (used for connecting to MetaMask) which persists as long as the page is open
  const web3ModalRef = useRef();

  // presaleMint: Mint an NFT during the presale
  const presaleMint = async () => 
  {
    try
    {
      //We need a signer here since this is a 'write' transaction
      const signer = await getProviderOrSigner(true);
      //Create a new instance of the Contract with a Signer, which allows update methods
      const whitelistContract = new Contract(NFT_CONTRACT_ADDRESS, abi, signer);
      //call the presaleMint from the contract, only whitelisted addresses would be able to mint
      const tx = await whitelistContract.presaleMint({
        //value signifies the cost of one crypto dev which is "0.01" eth.
        //We are parsing "0.01" string to ether using the utils library from ethers.js
        value: utils.parseEther("0.01"),
      });
      setLoading(true);
      //wait for the transaction to get mined
      await tx.wait();
      setLoading(false);
      window.alert("You successfully minted a Crypto Dev!");
    }catch(err)
    {
      console.error(err);
    }
  };

  //connectWallet: Connects the MetaMask wallet
  const connectWallet = async () => 
  {
    try
    {
      //get the provider from the web3Modal, which in our case is MetaMask,
      //When used for the first time, it prompts the user to connect the wallet
      await getProviderOrSigner();
      setWalletConnected(true);
    }catch(err)
    {
      console.error(err);
    }
  };

  //startPresale: starts the presale for the NFT Collection
  const startPresale = async () =>
  {
    try
    {
      //We need a signer here since it's a 'write' transaction.
      const signer = await getProviderOrSigner(true);
      //Create a new instance of the Contract with a Signer, which allows update methods
      const whitelistContract = new Contract(NFT_CONTRACT_ADDRESS, abi, signer);
      //call the startPresale from the contract
      const tx = await whitelistContract.startPresale();
      setLoading(false);
      //set the presale started to get mined
      await tx.wait();
      setLoading(false);
      //Set the presaleStarted to true
      await checkIfPresaleStarted();
    }catch(err)
    {
      console.error(err);
    }
  };

  const checkIfPresaleStarted = async() =>
  {
    try
    {
      //Get the provider from web3Modal, which in our case is MetaMask
      //No need for the signer here, as we are only reading state from the blockchain
      const provider = await getProviderOrSigner();
      //We connect to the Contract using a Provider, so we will only 
      //have read only access
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
      const _presaleStarted = await nftContract.presaleStarted();
      if(!_presaleStarted)
      {
        await getOwner();
      }
      setPresaleStarted(_presaleStarted);
      return _presaleStarted;
    }catch(err)
    {
      console.error(err);
      return false;
    }
  };

  //checkIfPresaleEnded: checks if the presale has ended by quering the 'presaleEnded' variable in the contract
  const checkIfPresaleEnded = async () => 
  {
    try
    {
      //Get the provider from web3Modal, which in our case is MetaMask,
      //No need for the signer here, as we are only reading state from the blockchain
      const provider = await getProviderOrSigner();
      // We connect to the Contract using a Provider, so we will only have read-only access to the Contract
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
      //call the presaleEnded from the Contract
      const _presaleEnded = await nftContract.presaleEnded();
      //PresaleEnded is big number, so we are using the lt(less than function) instead of '<'
      //Date.now()/1000 returns the current time in seconds
      //We compare if the _presaleEnd timestamp is less than the current timestamp,
      //which means presale whas ended
      const hasEnded = _presaleEnded.lt(Math.floor(Date.now() / 1000));
      if(hasEnded)
      {
        setPresaleEnded(true);
      }
      else
      {
        setPresaleEnded(false);
      }
      return hasEnded;
    }catch(err)
    {
      console.error(err);
      return false;
    }
  };

  //getOwner calls the Contract to retrieve tho Owner
  const getOwner = async () => 
  {
    try
    {
      //Get the provider from web3Modal, which in our case is MetaMask
      //No need for the Signer here, as we are only reading state from the blockchain
      const provider = await getProviderOrSigner();
      //We connect to the Contract using a Provider, so we will only 
      //have read only access to the Contract
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
      //Call the owner function from the Contract
      const _owner = await nftContract.owner();
      //We will get the signer now to extract the address of the currently connected MetaMask account
      const signer = await getProviderOrSigner(true);
      //Get the address associated to the signer which is connected to MetaMask
      const address = await signer.getAddress();
      if(address.toLowerCase() === _owner.toLowerCase())
      {
        setIsOwner(true);
      }
    }catch(err)
    {
      console.error(err);
    }
  };

  //getTokensMinted: gets the number of tokenIds that have been minted 
  const getTokenIdsMinted = async () => 
  {
    try
    {
      //Get the provider from web3Modal, which in our case is MetaMask
      //No need for the Signer here, as we are only reading from the Blockchain
      const provider = await getProviderOrSigner();
      //We connect to the Contract using a Provider, so we will have read-only access to the Contract
      const nftContract = new Contract(NFT_CONTRACT_ADDRESS, abi, provider);
      //call the tokenIds from the Contract
      const _tokenIds = await nftContract.tokenIds();
      //_tokenIds is a 'Big Number'. We need to convert the Big Number to a string 
      setTokenIdsMinted(_tokenIds.toString()); 
    }catch(err)
    {
      console.error(err);
    }
  };

  const getProviderOrSigner = async (needSigner = false) => 
  {
    //Connect to MetaMask
    //Since we store 'web3Modal' as a reference, we need access to the 'current' value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    //If user is not connected to the goerli network, let them know and throw an error
    const {chainId} = await web3Provider.getNetwork();
    if(chainId !== 5)
    {
      window.alert("Change the network to georli");
      throw new Error("Change the network to goerli");
    }

    if(needSigner)
    {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  //useEffects are used in react to change the state of the website
  //The Array at the end of function call represents what state changes will trigger this effect
  //In this case, whenever the value of 'walletConnected' changes - this effect will be called
  useEffect(() => {
    //If wallet is not connected, create a new instance of web3Modal and connect the MetaMask wallet
    if(!walletConnected)
    {
      //Assign the web3Modal class to the reference object by setting it's 'current' value
      //The 'current' value is persisted throughout as long as this page is open
      web3ModalRef.current = new Web3Modal({network: 'goerli', providerOptions: {}, disableInjectedProvider: false,});
      connectWallet();

      //Check if the presale has started and ended
      const _presaleStarted = checkIfPresaleStarted();
      if(_presaleStarted){
        checkIfPresaleEnded();
      }

      getTokenIdsMinted();

      //Set an interval which gets called every 5 seconds to check if presale has ended
      const presaleEndedInterval = setInterval(async function() {
        const _presaleStarted = await checkIfPresaleStarted();
        if(_presaleStarted)
        {
          const _presaleEnded = await checkIfPresaleEnded();
          if(_presaleEnded)
          {
            clearInterval(presaleEndedInterval);
          }
        }
      }, 5* 1000);

      //Set an intervall to get the number of token IDs minted every 5 seconds
      setInterval(async function() {
        await getTokenIdsMinted();
      }, 5 * 1000);
    }
  }, [walletConnected]);

  //renderButton: Returns a button based on the state of the dapp
  const renderButton = () => {
    //If wallet is not connected, return a button which allows them to connect their wallet 
    if(!walletConnected)
    {
      return(
        <button onClick={connectWallet} className={styles.button}>Connect your Wallet</button>
      );
    }

    //If we are currently waiting for something, return a loading button
    if(loading)
    {
      return <button className={styles.button}>Loading...</button>
    }

    //If connected user is the owner, and presale hasn't started yet, allow them to start the presale
    if(isOwner && !presaleStarted)
    {
      return(
        <button className={styles.button} onClick={startPresale}>Start Presale!</button>
      );
    }

    //If connected user is not the owner but presale hasn't started yet, tell them that
    if(!presaleStarted)
    {
      return(
        <div>
          <div className={styles.description}>Presale hasnt started!</div>
        </div>
      );
    }

    //If presale started, but hasn't ended yet, allow for minting during the presale period
    if(presaleStarted && !presaleEnded)
    {
      return(
        <div>
          <div className={styles.description}>
            Presale has started!!! If your address is whitelisted, Mint a Crypto Dev 🥳
          </div>
          <button className={styles.button} onClick={presaleMint}>Presale Mint 🚀</button>
        </div>
      );
    }

    //If presale started and has ended yet, its time for public minting
    if(presaleStarted && presaleEnded)
    {
      return(
        <button className={styles.button} onClick={publicMint}>Public Mint 🚀</button>
      );
    }
  };

  return (
    <div>
      <head>
        <title>Crypto Devs</title>
        <meta name="description" content="Whitelist-Dapp"/>
        <link rel="icon" href="/favicon.ico"/>
      </head>
      <div className={styles.main}>
        <div>
        <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
        <div className={styles.description}>
          Its an NFT collection for developers in Crypto.
        </div>
        <div className={styles.description}>
          {tokenIdsMinted}/20 have been minted
        </div>
        {renderButton()}
      </div>
      <div>
        <img className={styles.images} src="./crypto-devs.svg" />
      </div>
    </div>
    <footer className={styles.footer}>
      Made with &#10084; by Crypto Devs
    </footer>
    </div>
  );
}