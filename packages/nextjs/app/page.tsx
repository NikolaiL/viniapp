"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useAccount, useConfig, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const Home: NextPage = () => {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const { address } = useAccount();
  const config = useConfig();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Read contract info
  const { data: viniAppContract } = useDeployedContractInfo({ contractName: "ViniApp" });
  const { data: paymentTokenAddress } = useScaffoldReadContract({
    contractName: "ViniApp",
    functionName: "paymentToken",
  });
  const { data: viniappCost } = useScaffoldReadContract({
    contractName: "ViniApp",
    functionName: "viniappCost",
  });
  // On-chain approval check (has user approved enough tokens?)
  const { data: isApproved } = useScaffoldReadContract({
    contractName: "ViniApp",
    // Casts are needed until deployedContracts ABI is regenerated with isApproved
    functionName: "isApproved" as any,
    args: [((address as `0x${string}`) || ("0x0000000000000000000000000000000000000000" as `0x${string}`)) as any],
  } as any);

  // Write contract hook
  const { writeContractAsync: writeViniAppAsync, isMining } = useScaffoldWriteContract({
    contractName: "ViniApp",
  });

  // ERC20 approval
  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  // Transaction receipt for the main contract call
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }

    if (!name.trim() || !description.trim()) {
      notification.error("Please fill in all required fields");
      return;
    }

    if (!viniAppContract?.address || !paymentTokenAddress || !viniappCost) {
      notification.error("Contract not loaded. Please wait...");
      return;
    }

    try {
      // If already approved on-chain, skip approval and create directly
      if (isApproved) {
        notification.info("USDC already approved. Creating viniapp...");
        await handleStartViniappCreation();
        return;
      }

      // Step 1: Approve USDC tokens
      notification.info("Approving USDC tokens...");
      setIsApproving(true);

      const approveTxHash = await writeApproveAsync({
        address: paymentTokenAddress as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "approve",
        args: [viniAppContract.address as `0x${string}`, viniappCost],
      });

      // Wait for approval transaction to be mined
      await waitForTransactionReceipt(config, {
        hash: approveTxHash as `0x${string}`,
      });

      notification.success("USDC approval confirmed. Creating viniapp...");
      await handleStartViniappCreation();
    } catch (error: any) {
      console.error("Approval error:", error);
      notification.error(error?.message || "Failed to approve tokens");
    } finally {
      setIsApproving(false);
    }
  };

  const handleStartViniappCreation = async () => {
    try {
      notification.info("Creating viniapp...");

      const result = await writeViniAppAsync({
        functionName: "startViniappCreation",
      });

      if (result) {
        const hash = typeof result === "string" ? result : (result as any)?.hash || result;
        setTxHash(hash);
        notification.success(`Transaction sent! Hash: ${hash}`);
      }
    } catch (error: any) {
      console.error("Contract call error:", error);
      notification.error(error?.message || "Failed to create viniapp");
    }
  };

  // Show success when transaction is confirmed
  useEffect(() => {
    if (isConfirmed && txHash) {
      notification.success(`Viniapp created successfully! Transaction: ${txHash}`);

      // Async function to compress image before sending
      const compressImage = (base64String: string, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Could not get canvas context"));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
            resolve(compressedBase64);
          };
          img.onerror = reject;
          img.src = base64String;
        });
      };

      // Async function to send post request to VINIAPP_BACKEND via Next.js API proxy
      const sendToBackend = async () => {
        try {
          // Compress logo image if present
          let compressedLogo = logoPreview;
          if (logoPreview) {
            try {
              compressedLogo = await compressImage(logoPreview, 800, 0.8);
              console.log("Image compressed:", {
                original: logoPreview.length,
                compressed: compressedLogo.length,
                reduction: `${((1 - compressedLogo.length / logoPreview.length) * 100).toFixed(1)}%`,
              });
            } catch (error) {
              console.warn("Failed to compress image, sending original:", error);
            }
          }

          const response = await fetch("/api/create-viniapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              prompt: description,
              logo_image: compressedLogo,
              transaction_hash: txHash,
              msg_sender: address,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Backend request failed: ${response.statusText}`);
          }

          const data = await response.json();
          console.log("Backend response:", data);
        } catch (error: any) {
          console.error("Backend request error:", error);
          notification.error(error?.message || "Failed to send data to backend");
        }
      };

      sendToBackend();

      // Reset form
      setName("");
      setDescription("");
      setLogo(null);
      setLogoPreview(null);
      setTxHash(null);
    }
  }, [isConfirmed, txHash, name, description, logoPreview, address]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogo(file);
    }
  };

  useEffect(() => {
    if (logo) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(logo);
    } else {
      setLogoPreview(null);
    }
  }, [logo]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center grow py-10">
        <div className="w-full max-w-2xl px-4">
          <div className="rounded-3xl border border-base-300 bg-base-100/80 px-6 py-8 shadow-lg">
            <h1 className="text-center text-3xl font-semibold tracking-tight text-base-content mb-3">
              Generate Viniapp Miniapp
            </h1>
            <p className="text-center text-sm text-base-content/60">Loading your builder studio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-center grow py-10">
        <div className="w-full max-w-2xl px-4">
          <div className="rounded-3xl border border-base-300 bg-base-100/90 px-6 py-8 shadow-xl">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                Viniapp Mini Builder
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-base-content">Generate Viniapp Miniapp</h1>
              <p className="mt-2 text-sm text-base-content/60">
                Describe your idea, drop a logo, and we&apos;ll spin up the onchain miniapp for you.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="Enter miniapp name"
                />
              </div>

              {/* Logo File Input */}
              <div>
                <label htmlFor="logo" className="block text-sm font-medium mb-2">
                  Logo
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="file-input file-input-bordered w-full sm:max-w-xs"
                  />
                  {logoPreview && (
                    <div className="mx-auto mt-2 sm:mt-0 sm:ml-4">
                      <div className="relative rounded-2xl border border-base-300 bg-base-100 p-1 shadow-md">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="max-h-24 w-auto rounded-xl object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description TextArea */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Describe what you want to build
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="textarea textarea-bordered w-full min-h-32 rounded-2xl"
                  placeholder="Describe your miniapp idea..."
                />
              </div>

              {/* Submit Button */}
              <div className="flex flex-col items-center space-y-2">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full max-w-md"
                  disabled={isMining || isApproving || isConfirming || !address}
                >
                  {isApproving ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Approving...
                    </>
                  ) : isMining || isConfirming ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Processing...
                    </>
                  ) : (
                    "Let's go"
                  )}
                </button>
                <p className="text-sm text-base-content/70">Best way to spend your 20 USDC</p>
                {txHash && <p className="text-xs text-base-content/50 mt-2 break-all">Tx: {txHash}</p>}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
